"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { productVersions } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  extractDocumentText,
  runDocumentExtraction,
} from "@/lib/server/document-extraction";
import {
  matchExtractedItemsToVerifiedProducts,
  type ProductMatchResult,
  type VerifiedProductCandidate,
} from "@/lib/server/product-matching";
import {
  prepareProjectDocument,
  prepareSpecificationPdf,
  readLocalUpload,
  saveLocalUpload,
} from "@/lib/server/upload-utils";
import {
  createLocalExtractionFromClientRequest,
  getLocalExtractedItem,
  publishLocalHandoverPackage,
  updateLocalExtractedItem,
  updateLocalExtractedItemStatus,
} from "@/lib/server/local-store/specifications";
import {
  applyLocalProductMatches,
  getLocalDocumentExtractionJobs,
  getLocalExtractedWorkflowItem,
  getLocalUploadedDocuments,
  saveLocalDocumentExtractionJob,
  saveLocalExtractedWorkflowItems,
  saveLocalItemReviewAction,
  saveLocalUploadedDocument,
  updateLocalDocumentExtractionJob,
  updateLocalExtractedWorkflowItemReview,
  updateLocalUploadedDocumentStatus,
} from "@/lib/server/local-store/uploaded-documents";
import {
  getLocalClientRequest,
  saveLocalClientRequest,
  updateLocalClientRequestStatus,
} from "@/lib/server/local-store/client-requests";
import { getLocalGlobalProducts, upsertLocalGlobalProductFromExtractedItem } from "@/lib/server/local-store/products";
import { enrichExtractedProduct } from "@/lib/ai/source-enrichment";
import type { ExtractedHandoverItem } from "@/lib/types";
import type {
  ExtractedItemReviewStatus,
  ExtractedWorkflowItem,
  ItemReviewActionType,
} from "@/lib/document-workflow";

function getRequired(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }

  return value.trim();
}

function getOptional(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getSafeBuilderNext(value: FormDataEntryValue | string | null) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/builder") ||
    value.startsWith("//") ||
    value.startsWith("/builder/onboarding")
  ) {
    return "/builder/projects";
  }

  return value;
}

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function hasUnlimitedProjectCredits(email?: string | null) {
  return email?.toLowerCase() === "test@gmail.com";
}

type ProjectCreditAccount = {
  tableAvailable: boolean;
  unlimited: boolean;
  balance: number;
};

function isMissingBillingTable(error: { message?: string; code?: string } | null) {
  return Boolean(
    error?.code === "42P01" ||
      error?.message?.includes("project_credit_accounts") ||
      error?.message?.includes("project_credit_events"),
  );
}

function isMissingBillingRpc(error: { message?: string; code?: string } | null, functionName: string) {
  return Boolean(
    error?.code === "42883" ||
      error?.message?.includes(functionName) ||
      error?.message?.includes("Could not find the function"),
  );
}

async function getProjectCreditAccount(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organisationId: string;
  email?: string | null;
}): Promise<ProjectCreditAccount> {
  const emailHasUnlimitedCredits = hasUnlimitedProjectCredits(input.email);
  const { data, error } = await input.supabase
    .from("project_credit_accounts")
    .select("credit_balance,unlimited")
    .eq("organisation_id", input.organisationId)
    .maybeSingle();

  if (isMissingBillingTable(error)) {
    return {
      tableAvailable: false,
      unlimited: emailHasUnlimitedCredits,
      balance: emailHasUnlimitedCredits ? Number.MAX_SAFE_INTEGER : 0,
    };
  }

  if (error) {
    redirect("/builder/projects?error=credit-check-failed");
  }

  if (!data && emailHasUnlimitedCredits) {
    await input.supabase.from("project_credit_accounts").upsert({
      organisation_id: input.organisationId,
      unlimited: true,
      credit_balance: 0,
      updated_at: new Date().toISOString(),
    });
  }

  return {
    tableAvailable: true,
    unlimited: Boolean(data?.unlimited) || emailHasUnlimitedCredits,
    balance: data?.credit_balance || 0,
  };
}

async function recordProjectCreditUse(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organisationId: string;
  projectId: string;
  creditAccount: ProjectCreditAccount;
}) {
  if (!input.creditAccount.tableAvailable) {
    return;
  }

  const { error: rpcError } = await input.supabase.rpc("consume_project_credit", {
    target_organisation_id: input.organisationId,
    target_project_id: input.projectId,
    event_notes: input.creditAccount.unlimited
      ? "Unlimited test credits."
      : "Project creation credit used.",
  });

  if (!rpcError) {
    return;
  }

  if (rpcError.message?.includes("insufficient_project_credits")) {
    redirect("/builder/projects?error=insufficient-project-credits");
  }

  if (!isMissingBillingRpc(rpcError, "consume_project_credit")) {
    redirect("/builder/projects?error=credit-deduct-failed");
  }

  const balanceAfter = input.creditAccount.unlimited
    ? input.creditAccount.balance
    : input.creditAccount.balance - 1;

  if (!input.creditAccount.unlimited) {
    const { error: updateError } = await input.supabase
      .from("project_credit_accounts")
      .update({
        credit_balance: balanceAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("organisation_id", input.organisationId);

    if (updateError) {
      redirect("/builder/projects?error=credit-deduct-failed");
    }
  }

  const { error: eventError } = await input.supabase.from("project_credit_events").insert({
    organisation_id: input.organisationId,
    project_id: input.projectId,
    event_type: "project_created",
    credit_delta: input.creditAccount.unlimited ? 0 : -1,
    balance_after: input.creditAccount.unlimited ? null : balanceAfter,
    notes: input.creditAccount.unlimited ? "Unlimited test credits." : "Project creation credit used.",
  });

  if (eventError && !isMissingBillingTable(eventError)) {
    redirect("/builder/projects?error=credit-event-failed");
  }
}

function parseExtractedItemType(value: string): ExtractedHandoverItem["itemType"] | null {
  if (value === "product" || value === "document" || value === "maintenance") {
    return value;
  }

  return null;
}

function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createInviteEmail(input: {
  clientName: string;
  projectName: string;
  projectAddress: string;
  acceptUrl: string;
}) {
  const safeClientName = escapeHtml(input.clientName || "there");
  const safeProjectName = escapeHtml(input.projectName);
  const safeProjectAddress = escapeHtml(input.projectAddress);
  const safeAcceptUrl = escapeHtml(input.acceptUrl);

  return {
    subject: `Your handover package for ${input.projectName}`,
    text: [
      `Hi ${input.clientName || "there"},`,
      "",
      `Your builder has invited you to view the handover package for ${input.projectName}, ${input.projectAddress}.`,
      "",
      `Open your invite: ${input.acceptUrl}`,
      "",
      "You will need to sign in with the same email address this invite was sent to.",
    ].join("\n"),
    html: [
      `<p>Hi ${safeClientName},</p>`,
      `<p>Your builder has invited you to view the handover package for <strong>${safeProjectName}</strong>, ${safeProjectAddress}.</p>`,
      `<p><a href="${safeAcceptUrl}">Open your handover invite</a></p>`,
      "<p>You will need to sign in with the same email address this invite was sent to.</p>",
    ].join(""),
  };
}

async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false, reason: "invite-email-not-configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: [
          { name: "category", value: "client_invite" },
        ],
      }),
    });

    return { ok: response.ok, reason: response.ok ? null : "invite-email-send-failed" };
  } catch {
    return { ok: false, reason: "invite-email-send-failed" };
  }
}

type ExtractedItemEditInput = {
  itemId: string;
  itemType: ExtractedHandoverItem["itemType"] | null;
  title: string;
  category: string;
  location: string;
  extractedText: string;
  sourceSnippet?: string;
  sourcePage?: number;
  reviewReason?: string;
  confidenceScore: number;
};

function redirectToExtractedItemEditError(itemId: string, error: string): never {
  redirect(`/builder/specifications/review/${itemId}/edit?error=${error}`);
}

function includesAnyTerm(value: string, terms: string[]) {
  const normalisedValue = value.toLowerCase();
  return terms.some((term) => normalisedValue.includes(term));
}

function isMissingReviewReasonColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("review_reason"));
}

function validateExtractedItemEdit(input: ExtractedItemEditInput) {
  const sourceSnippetLength = input.sourceSnippet?.length || 0;

  if (
    !input.itemType ||
    input.title.length < 3 ||
    input.category.length < 2 ||
    input.extractedText.length < 8 ||
    input.confidenceScore < 0 ||
    input.confidenceScore > 100
  ) {
    return "check-required-fields";
  }

  if (input.confidenceScore >= 75 && sourceSnippetLength < 16 && !input.sourcePage) {
    return "source-context-required";
  }

  if (input.confidenceScore < 65 && (input.reviewReason?.length || 0) < 12) {
    return "review-reason-required";
  }

  if (input.itemType === "product") {
    const productIdentityTerms = ["unknown", "unspecified", "generic", "tbc", "to confirm"];

    if (input.location.length < 2) {
      return "product-location-required";
    }

    if (input.confidenceScore >= 65 && includesAnyTerm(input.title, productIdentityTerms)) {
      return "product-identity-required";
    }
  }

  if (input.itemType === "document") {
    if (input.category === "To review" || input.category === "Document") {
      return "document-category-required";
    }

    if (sourceSnippetLength < 12 && input.extractedText.length < 20) {
      return "document-source-required";
    }
  }

  if (input.itemType === "maintenance") {
    const maintenanceText = `${input.title} ${input.category} ${input.extractedText}`;
    const maintenanceActionTerms = ["clean", "inspect", "maintain", "replace", "service", "test", "wash"];

    if (!includesAnyTerm(maintenanceText, maintenanceActionTerms)) {
      return "maintenance-action-required";
    }

    if (sourceSnippetLength < 12 && input.extractedText.length < 20) {
      return "maintenance-detail-required";
    }
  }

  return null;
}

async function getBuilderContext() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: member, error } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !member) {
    redirect("/builder/onboarding?next=/builder/projects");
  }

  return { supabase, userId: user.id, organisationId: member.organisation_id as string };
}

export async function createBuilderWorkspaceAction(formData: FormData) {
  const orgName = getRequired(formData, "orgName");
  const tradingName = getOptional(formData, "tradingName");
  const contactPhone = getOptional(formData, "contactPhone");
  const next = getSafeBuilderNext(formData.get("next"));

  if (!hasSupabaseConfig()) {
    redirect(next);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/builder/onboarding")}`);
  }

  const { error } = await supabase.rpc("ensure_builder_workspace", {
    org_name: orgName,
    trading_name: tradingName,
    contact_phone: contactPhone,
  });

  if (error) {
    redirect("/builder/onboarding?error=create-workspace-failed");
  }

  redirect(next);
}

export async function updateBuilderOrganisationAction(formData: FormData) {
  const name = getRequired(formData, "name");
  const tradingName = getOptional(formData, "tradingName");
  const contactEmail = getOptional(formData, "contactEmail");
  const contactPhone = getOptional(formData, "contactPhone");
  const context = await getBuilderContext();

  if (context) {
    const { error } = await context.supabase
      .from("organisations")
      .update({
        name,
        trading_name: tradingName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      })
      .eq("id", context.organisationId);

    if (error) {
      redirect("/builder/settings?error=update-organisation-failed");
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      actor_user_id: context.userId,
      action: "Organisation settings updated",
      detail: `Updated organisation contact settings for ${name}.`,
    });
  }

  redirect(`/builder/settings?draft=organisation-saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function createProjectAction(formData: FormData) {
  const name = getRequired(formData, "name");
  const address = getRequired(formData, "address");
  const projectType = getRequired(formData, "projectType");
  const clientName = getRequired(formData, "clientName");
  const clientEmail = getRequired(formData, "clientEmail");
  const handoverDate = getOptional(formData, "handoverDate");
  const upload = await prepareSpecificationPdf(formData);
  const context = await getBuilderContext();

  if (context) {
    const {
      data: { user },
    } = await context.supabase.auth.getUser();

    if (!hasUnlimitedProjectCredits(user?.email) && formData.get("creditConfirmed") !== "on") {
      redirect("/builder/projects?error=project-credit-not-confirmed");
    }

    const creditAccount = await getProjectCreditAccount({
      supabase: context.supabase,
      organisationId: context.organisationId,
      email: user?.email,
    });

    if (!creditAccount.unlimited && creditAccount.tableAvailable && creditAccount.balance < 1) {
      redirect("/builder/projects?error=insufficient-project-credits");
    }

    const { data: project, error: projectError } = await context.supabase
      .from("projects")
      .insert({
        organisation_id: context.organisationId,
        name,
        address,
        project_type: projectType,
        handover_date: handoverDate,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      redirect("/builder/projects?error=create-project-failed");
    }

    await recordProjectCreditUse({
      supabase: context.supabase,
      organisationId: context.organisationId,
      projectId: project.id,
      creditAccount,
    });

    await context.supabase.from("project_clients").insert({
      project_id: project.id,
      name: clientName,
      email: clientEmail,
    });

    if (upload) {
      const storagePath = upload.storagePath;
      const { error: uploadError } = await context.supabase.storage
        .from("handover-documents")
        .upload(storagePath, upload.bytes, {
          contentType: upload.type,
          upsert: false,
        });

      if (!uploadError) {
        await context.supabase.from("specification_uploads").insert({
          project_id: project.id,
          uploaded_by: context.userId,
          file_name: upload.fileName,
          storage_path: storagePath,
          status: "uploaded",
        });
      }
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      project_id: project.id,
      actor_user_id: context.userId,
      action: "Project created",
      detail: `Created ${name} for ${clientName}.`,
    });
  } else if (upload) {
    await saveLocalUpload(upload.storagePath, upload.bytes);
  }

  redirect(`/builder/projects?draft=saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function updateProjectAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const name = getRequired(formData, "name");
  const address = getRequired(formData, "address");
  const projectType = getRequired(formData, "projectType");
  const clientName = getRequired(formData, "clientName");
  const clientEmail = getRequired(formData, "clientEmail");
  const handoverDate = getOptional(formData, "handoverDate");
  const context = await getBuilderContext();

  if (context) {
    const { error: projectError } = await context.supabase
      .from("projects")
      .update({
        name,
        address,
        project_type: projectType,
        handover_date: handoverDate,
      })
      .eq("id", projectId);

    if (projectError) {
      redirect("/builder/projects?error=update-project-failed");
    }

    const { data: existingClient } = await context.supabase
      .from("project_clients")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .maybeSingle();

    if (existingClient?.id) {
      await context.supabase
        .from("project_clients")
        .update({ name: clientName, email: clientEmail })
        .eq("id", existingClient.id);
    } else {
      await context.supabase.from("project_clients").insert({
        project_id: projectId,
        name: clientName,
        email: clientEmail,
      });
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      project_id: projectId,
      actor_user_id: context.userId,
      action: "Project updated",
      detail: `Updated ${name}.`,
    });
  }

  redirect(`/builder/projects?draft=saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function createClientInviteAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const context = await getBuilderContext();

  if (!context) {
    redirect("/builder/projects?error=invite-requires-supabase");
  }

  const { data: client, error: clientError } = await context.supabase
    .from("project_clients")
    .select("id,name,email,accepted_at")
    .eq("project_id", projectId)
    .limit(1)
    .single();

  if (clientError || !client) {
    redirect("/builder/projects?error=client-not-found");
  }

  if (client.accepted_at) {
    redirect("/builder/projects?error=client-already-accepted");
  }

  const token = createInviteToken();
  const { error: inviteError } = await context.supabase
    .from("project_clients")
    .update({
      invite_token_hash: hashInviteToken(token),
      invited_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (inviteError) {
    redirect("/builder/projects?error=create-client-invite-failed");
  }

  await context.supabase.from("audit_events").insert({
    organisation_id: context.organisationId,
    project_id: projectId,
    actor_user_id: context.userId,
    action: "Client invite link created",
    detail: `Created an invite link for ${client.name || client.email}.`,
  });

  const params = new URLSearchParams({
    draft: "invite-created",
    storage: "supabase",
    projectId,
    inviteToken: token,
  });

  redirect(`/builder/projects?${params.toString()}`);
}

export async function sendClientInviteEmailAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const context = await getBuilderContext();

  if (!context) {
    redirect("/builder/projects?error=invite-requires-supabase");
  }

  const { data: project, error: projectError } = await context.supabase
    .from("projects")
    .select("id,name,address")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    redirect("/builder/projects?error=project-not-found");
  }

  const { data: client, error: clientError } = await context.supabase
    .from("project_clients")
    .select("id,name,email,accepted_at")
    .eq("project_id", projectId)
    .limit(1)
    .single();

  if (clientError || !client) {
    redirect("/builder/projects?error=client-not-found");
  }

  if (client.accepted_at) {
    redirect("/builder/projects?error=client-already-accepted");
  }

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const { error: inviteError } = await context.supabase
    .from("project_clients")
    .update({
      invite_token_hash: tokenHash,
      invited_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (inviteError) {
    redirect("/builder/projects?error=create-client-invite-failed");
  }

  const acceptUrl = `${getAppBaseUrl()}/client/accept-invite?token=${encodeURIComponent(token)}`;
  const email = createInviteEmail({
    clientName: client.name,
    projectName: project.name,
    projectAddress: project.address,
    acceptUrl,
  });
  const sendResult = await sendResendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: `client-invite-${client.id}-${tokenHash.slice(0, 20)}`,
  });

  await context.supabase.from("audit_events").insert({
    organisation_id: context.organisationId,
    project_id: projectId,
    actor_user_id: context.userId,
    action: sendResult.ok ? "Client invite email sent" : "Client invite email failed",
    detail: sendResult.ok
      ? `Sent a handover invite email to ${client.email}.`
      : `Created an invite link for ${client.email}, but email delivery failed.`,
    metadata: {
      email: client.email,
      delivery: sendResult.ok ? "sent" : sendResult.reason,
    },
  });

  const params = new URLSearchParams({
    draft: sendResult.ok ? "invite-email-sent" : "invite-created",
    storage: "supabase",
    projectId,
  });

  if (!sendResult.ok) {
    params.set("error", sendResult.reason || "invite-email-send-failed");
    params.set("inviteToken", token);
  }

  redirect(`/builder/projects?${params.toString()}`);
}

export async function revokeClientInviteAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const context = await getBuilderContext();

  if (!context) {
    redirect("/builder/projects?error=invite-requires-supabase");
  }

  const { data: client, error: clientError } = await context.supabase
    .from("project_clients")
    .select("id,name,email,accepted_at")
    .eq("project_id", projectId)
    .limit(1)
    .single();

  if (clientError || !client) {
    redirect("/builder/projects?error=client-not-found");
  }

  if (client.accepted_at) {
    redirect("/builder/projects?error=client-already-accepted");
  }

  const { error: revokeError } = await context.supabase
    .from("project_clients")
    .update({
      invite_token_hash: null,
      invited_at: null,
    })
    .eq("id", client.id);

  if (revokeError) {
    redirect("/builder/projects?error=revoke-client-invite-failed");
  }

  await context.supabase.from("audit_events").insert({
    organisation_id: context.organisationId,
    project_id: projectId,
    actor_user_id: context.userId,
    action: "Client invite link revoked",
    detail: `Revoked the invite link for ${client.name || client.email}.`,
  });

  redirect("/builder/projects?draft=invite-revoked&storage=supabase");
}

export async function acceptClientInviteAction(formData: FormData) {
  const token = getRequired(formData, "token");

  if (!hasSupabaseConfig()) {
    redirect(`/client/accept-invite?mode=stub&token=${encodeURIComponent(token)}`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const params = new URLSearchParams({
      next: `/client/accept-invite?token=${token}`,
    });
    redirect(`/login?${params.toString()}`);
  }

  const { error } = await supabase.rpc("accept_project_client_invite", {
    raw_token: token,
  });

  if (error) {
    redirect(`/client/accept-invite?error=invalid-invite&token=${encodeURIComponent(token)}`);
  }

  redirect("/client/portal?invite=accepted");
}

type BuilderActionContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  organisationId: string;
};

type WorkflowDocumentForExtraction = {
  id: string;
  projectId: string;
  originalFilename: string;
  fileType?: string;
  mimeType: string;
  storagePath?: string;
};

async function insertWorkflowAuditLog(
  context: BuilderActionContext,
  input: {
    projectId: string;
    eventType: string;
    detail: string;
    metadata?: Record<string, unknown>;
  },
) {
  await context.supabase.from("audit_logs").insert({
    project_id: input.projectId,
    actor_user_id: context.userId,
    event_type: input.eventType,
    detail: input.detail,
    metadata: input.metadata || {},
  });
}

type WorkflowReviewItem = {
  id: string;
  projectId: string;
  reviewStatus: ExtractedItemReviewStatus;
};

type WorkflowReviewMutation = {
  actionType: ItemReviewActionType;
  nextReviewStatus?: ExtractedItemReviewStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
  itemUpdate?: Partial<{
    productName: string | null;
    brand: string | null;
    model: string | null;
    category: string | null;
    supplier: string | null;
    location: string | null;
    warrantyText: string | null;
    maintenanceText: string | null;
    reviewStatus: ExtractedItemReviewStatus;
    approvedBy: string | null;
    approvedAt: string | null;
    excludedAt: string | null;
    exclusionReason: string | null;
  }>;
};

function redirectWorkflowReviewSuccess() {
  redirect(`/builder/projects?draft=workflow-review-saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

function redirectWorkflowReviewError(error: string): never {
  redirect(`/builder/projects?error=${error}`);
}

async function getSupabaseWorkflowReviewItem(
  context: BuilderActionContext,
  itemId: string,
): Promise<WorkflowReviewItem> {
  const { data: item, error: itemError } = await context.supabase
    .from("extracted_items")
    .select("id,project_id,review_status")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    redirectWorkflowReviewError("workflow-item-not-found");
  }

  const { data: project, error: projectError } = await context.supabase
    .from("projects")
    .select("id")
    .eq("id", item.project_id)
    .eq("organisation_id", context.organisationId)
    .single();

  if (projectError || !project) {
    redirectWorkflowReviewError("project-not-found");
  }

  return {
    id: item.id,
    projectId: item.project_id,
    reviewStatus: item.review_status,
  };
}

async function recordSupabaseWorkflowReview(
  context: BuilderActionContext,
  item: WorkflowReviewItem,
  mutation: WorkflowReviewMutation,
) {
  const nextReviewStatus = mutation.nextReviewStatus || item.reviewStatus;
  const update = mutation.itemUpdate;

  if (update) {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ("productName" in update) updatePayload.product_name = update.productName;
    if ("brand" in update) updatePayload.brand = update.brand;
    if ("model" in update) updatePayload.model = update.model;
    if ("category" in update) updatePayload.category = update.category;
    if ("supplier" in update) updatePayload.supplier = update.supplier;
    if ("location" in update) updatePayload.location = update.location;
    if ("warrantyText" in update) updatePayload.warranty_text = update.warrantyText;
    if ("maintenanceText" in update) updatePayload.maintenance_text = update.maintenanceText;
    if ("reviewStatus" in update) updatePayload.review_status = update.reviewStatus;
    if ("approvedBy" in update) {
      updatePayload.approved_by = update.approvedBy === "__current_user__" ? context.userId : update.approvedBy;
    }
    if ("approvedAt" in update) updatePayload.approved_at = update.approvedAt;
    if ("excludedAt" in update) updatePayload.excluded_at = update.excludedAt;
    if ("exclusionReason" in update) updatePayload.exclusion_reason = update.exclusionReason;

    const { error: updateError } = await context.supabase
      .from("extracted_items")
      .update(updatePayload)
      .eq("id", item.id);

    if (updateError) {
      redirectWorkflowReviewError("workflow-review-update-failed");
    }
  }

  const { error: actionError } = await context.supabase.from("item_review_actions").insert({
    project_id: item.projectId,
    extracted_item_id: item.id,
    action_type: mutation.actionType,
    action_by: context.userId,
    previous_review_status: item.reviewStatus,
    next_review_status: nextReviewStatus,
    notes: mutation.notes || null,
    metadata: mutation.metadata || {},
  });

  if (actionError) {
    redirectWorkflowReviewError("workflow-review-action-failed");
  }

  await insertWorkflowAuditLog(context, {
    projectId: item.projectId,
    eventType: `workflow_item_${mutation.actionType}`,
    detail: `Workflow item review action: ${mutation.actionType.replaceAll("_", " ")}.`,
    metadata: {
      extracted_item_id: item.id,
      previous_review_status: item.reviewStatus,
      next_review_status: nextReviewStatus,
      ...mutation.metadata,
    },
  });
}

async function recordLocalWorkflowReview(itemId: string, mutation: WorkflowReviewMutation) {
  const item = await getLocalExtractedWorkflowItem(itemId);

  if (!item) {
    redirectWorkflowReviewError("workflow-item-not-found");
  }

  const nextReviewStatus = mutation.nextReviewStatus || item.reviewStatus;
  const update = mutation.itemUpdate;

  if (update) {
    const localUpdate: Parameters<typeof updateLocalExtractedWorkflowItemReview>[1] = {};

    if ("productName" in update) localUpdate.productName = update.productName === null ? undefined : update.productName;
    if ("brand" in update) localUpdate.brand = update.brand === null ? undefined : update.brand;
    if ("model" in update) localUpdate.model = update.model === null ? undefined : update.model;
    if ("category" in update) localUpdate.category = update.category === null ? undefined : update.category;
    if ("supplier" in update) localUpdate.supplier = update.supplier === null ? undefined : update.supplier;
    if ("location" in update) localUpdate.location = update.location === null ? undefined : update.location;
    if ("warrantyText" in update) localUpdate.warrantyText = update.warrantyText === null ? undefined : update.warrantyText;
    if ("maintenanceText" in update) localUpdate.maintenanceText = update.maintenanceText === null ? undefined : update.maintenanceText;
    if ("reviewStatus" in update) localUpdate.reviewStatus = update.reviewStatus;
    if ("approvedBy" in update) {
      localUpdate.approvedBy = update.approvedBy === null
        ? undefined
        : update.approvedBy === "__current_user__"
          ? "local-scaffold"
          : update.approvedBy;
    }
    if ("approvedAt" in update) localUpdate.approvedAt = update.approvedAt === null ? undefined : update.approvedAt;
    if ("excludedAt" in update) localUpdate.excludedAt = update.excludedAt === null ? undefined : update.excludedAt;
    if ("exclusionReason" in update) {
      localUpdate.exclusionReason = update.exclusionReason === null ? undefined : update.exclusionReason;
    }

    await updateLocalExtractedWorkflowItemReview(item.id, localUpdate);
  }

  await saveLocalItemReviewAction({
    projectId: item.projectId,
    extractedItemId: item.id,
    actionType: mutation.actionType,
    actionBy: "local-scaffold",
    previousReviewStatus: item.reviewStatus,
    nextReviewStatus,
    notes: mutation.notes,
    metadata: mutation.metadata,
  });
}

async function reviewWorkflowItem(itemId: string, mutation: WorkflowReviewMutation) {
  const context = await getBuilderContext();

  if (context) {
    const item = await getSupabaseWorkflowReviewItem(context, itemId);
    await recordSupabaseWorkflowReview(context, item, mutation);
  } else {
    await recordLocalWorkflowReview(itemId, mutation);
  }

  redirectWorkflowReviewSuccess();
}

async function getSupabaseVerifiedProductCandidates(context: BuilderActionContext): Promise<VerifiedProductCandidate[]> {
  const { data, error } = await context.supabase
    .from("product_versions")
    .select("product_id,status,confidence_score,products(canonical_name,brand,category)")
    .eq("status", "approved");

  if (error || !data) {
    return [];
  }

  return data.map((version) => {
    const product = Array.isArray(version.products) ? version.products[0] : version.products;

    return {
      productId: version.product_id,
      productName: product?.canonical_name || "",
      brand: product?.brand || undefined,
      category: product?.category || undefined,
      confidenceScore: version.confidence_score,
      status: version.status,
    };
  });
}

async function getLocalVerifiedProductCandidates(): Promise<VerifiedProductCandidate[]> {
  const localProducts = await getLocalGlobalProducts();
  const candidates = [...localProducts, ...productVersions];

  return candidates.map((product) => ({
    productId: product.id,
    productName: product.productName,
    brand: product.brand,
    category: product.category,
    confidenceScore: product.confidenceScore,
    status: product.status,
  }));
}

async function applySupabaseProductMatches(
  context: BuilderActionContext,
  matches: ProductMatchResult[],
) {
  for (const match of matches) {
    const { error } = await context.supabase
      .from("extracted_items")
      .update({
        match_status: match.matchStatus,
        review_status: match.reviewStatus,
        matched_product_id: match.matchedProductId || null,
      })
      .eq("id", match.extractedItemId);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (matches.length === 0) {
    return;
  }

  const { error: deleteError } = await context.supabase.from("product_matches").delete().in(
    "extracted_item_id",
    matches.map((match) => match.extractedItemId),
  );

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: insertError } = await context.supabase.from("product_matches").insert(
    matches.map((match) => ({
      extracted_item_id: match.extractedItemId,
      matched_product_id: match.matchedProductId || null,
      match_status: match.matchStatus,
      match_confidence_score: match.matchConfidenceScore,
      match_reason: match.matchReason,
    })),
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function processSupabaseDocumentExtractionJob(
  context: BuilderActionContext,
  input: {
    document: WorkflowDocumentForExtraction;
    bytes?: Buffer;
    jobId?: string;
    retryCount?: number;
  },
) {
  let jobId = input.jobId;
  const retryCount = input.retryCount || 0;
  const startedAt = new Date().toISOString();

  if (!jobId) {
    const { data: job, error: jobError } = await context.supabase
      .from("document_extraction_jobs")
      .insert({
        project_id: input.document.projectId,
        uploaded_document_id: input.document.id,
        status: "queued",
      })
      .select("id")
      .single();

    if (jobError || !job) {
      redirect("/builder/projects?error=create-extraction-job-failed");
    }

    jobId = job.id;
  }
  if (!jobId) {
    redirect("/builder/projects?error=create-extraction-job-failed");
  }
  const activeJobId: string = jobId;

  await context.supabase
    .from("document_extraction_jobs")
    .update({
      status: "processing",
      error_message: null,
      started_at: startedAt,
      completed_at: null,
      retry_count: retryCount,
    })
    .eq("id", activeJobId);
  await context.supabase
    .from("uploaded_documents")
    .update({ processing_status: "processing" })
    .eq("id", input.document.id);
  await insertWorkflowAuditLog(context, {
    projectId: input.document.projectId,
    eventType: "ai_extraction_started",
    detail: `Started placeholder extraction for ${input.document.originalFilename}.`,
    metadata: {
      extraction_job_id: activeJobId,
      uploaded_document_id: input.document.id,
      extractor: process.env.OPENAI_API_KEY ? "openai_phase_4" : "mock_phase_3",
    },
  });

  try {
    let documentText = "";
    let documentTextMetadata: Record<string, unknown> = {};

    if (input.bytes) {
      const extractedText = await extractDocumentText({
        bytes: input.bytes,
        fileName: input.document.originalFilename,
        fileType: input.document.fileType,
        mimeType: input.document.mimeType,
      });
      documentText = extractedText.text;
      documentTextMetadata = extractedText.metadata;
    }

    const extraction = await runDocumentExtraction({
      jobId: activeJobId,
      document: input.document,
      documentText,
    });
    const extractedItems = extraction.items;

    await context.supabase.from("extracted_items").delete().eq("extraction_job_id", activeJobId);

    let insertedItems: ExtractedWorkflowItem[] = [];

    if (extractedItems.length > 0) {
      const { data: insertedRows, error: itemError } = await context.supabase.from("extracted_items").insert(
        extractedItems.map((item) => ({
          project_id: item.projectId,
          source_document_id: item.sourceDocumentId,
          extraction_job_id: item.extractionJobId,
          raw_extracted_data: item.rawExtractedData,
          product_name: item.productName || null,
          brand: item.brand || null,
          model: item.model || null,
          category: item.category || null,
          supplier: item.supplier || null,
          location: item.location || null,
          warranty_text: item.warrantyText || null,
          maintenance_text: item.maintenanceText || null,
          confidence_score: item.confidenceScore,
          match_status: item.matchStatus,
          review_status: item.reviewStatus,
        })),
      ).select(
        "id,project_id,source_document_id,extraction_job_id,raw_extracted_data,product_name,brand,model,category,supplier,location,warranty_text,maintenance_text,confidence_score,match_status,review_status,matched_product_id,approved_by,approved_at,excluded_at,exclusion_reason,created_at,updated_at",
      );

      if (itemError) {
        throw new Error(itemError.message);
      }

      insertedItems = (insertedRows || []).map((item) => ({
        id: item.id,
        projectId: item.project_id,
        sourceDocumentId: item.source_document_id,
        extractionJobId: item.extraction_job_id || undefined,
        rawExtractedData: item.raw_extracted_data || {},
        productName: item.product_name || undefined,
        brand: item.brand || undefined,
        model: item.model || undefined,
        category: item.category || undefined,
        supplier: item.supplier || undefined,
        location: item.location || undefined,
        warrantyText: item.warranty_text || undefined,
        maintenanceText: item.maintenance_text || undefined,
        confidenceScore: item.confidence_score,
        matchStatus: item.match_status,
        reviewStatus: item.review_status,
        matchedProductId: item.matched_product_id || undefined,
        approvedBy: item.approved_by || undefined,
        approvedAt: item.approved_at || undefined,
        excludedAt: item.excluded_at || undefined,
        exclusionReason: item.exclusion_reason || undefined,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    }

    let matchedItemCount = 0;

    if (insertedItems.length > 0) {
      const candidates = await getSupabaseVerifiedProductCandidates(context);
      const matches = matchExtractedItemsToVerifiedProducts(insertedItems, candidates);
      matchedItemCount = matches.filter((match) => match.matchedProductId).length;
      await applySupabaseProductMatches(context, matches);
    }

    const completedAt = new Date().toISOString();
    await context.supabase
      .from("document_extraction_jobs")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", activeJobId);
    await context.supabase
      .from("uploaded_documents")
      .update({ processing_status: "completed" })
      .eq("id", input.document.id);
    await insertWorkflowAuditLog(context, {
      projectId: input.document.projectId,
      eventType: "ai_extraction_completed",
      detail: `Completed placeholder extraction for ${input.document.originalFilename}.`,
      metadata: {
        extraction_job_id: activeJobId,
        uploaded_document_id: input.document.id,
        extracted_item_count: extractedItems.length,
        matched_item_count: matchedItemCount,
        extractor: extraction.extractor,
        document_text: documentTextMetadata,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Placeholder extraction failed.";
    const completedAt = new Date().toISOString();

    await context.supabase
      .from("document_extraction_jobs")
      .update({ status: "failed", error_message: message, completed_at: completedAt })
      .eq("id", activeJobId);
    await context.supabase
      .from("uploaded_documents")
      .update({ processing_status: "failed" })
      .eq("id", input.document.id);
    await insertWorkflowAuditLog(context, {
      projectId: input.document.projectId,
      eventType: "ai_extraction_failed",
      detail: `Placeholder extraction failed for ${input.document.originalFilename}.`,
      metadata: {
        extraction_job_id: activeJobId,
        uploaded_document_id: input.document.id,
        error_message: message,
        extractor: process.env.OPENAI_API_KEY ? "openai_phase_4" : "mock_phase_3",
      },
    });
  }
}

async function processLocalDocumentExtractionJob(input: {
  document: WorkflowDocumentForExtraction;
  bytes?: Buffer;
  jobId?: string;
  retryCount?: number;
}) {
  let jobId = input.jobId;
  const retryCount = input.retryCount || 0;
  const startedAt = new Date().toISOString();

  if (!jobId) {
    const job = await saveLocalDocumentExtractionJob({
      projectId: input.document.projectId,
      uploadedDocumentId: input.document.id,
      status: "queued",
    });
    jobId = job.id;
  }
  if (!jobId) {
    throw new Error("Local extraction job could not be created.");
  }
  const activeJobId: string = jobId;

  await updateLocalDocumentExtractionJob(activeJobId, {
    status: "processing",
    errorMessage: undefined,
    startedAt,
    completedAt: undefined,
    retryCount,
  });
  await updateLocalUploadedDocumentStatus(input.document.id, "processing");

  try {
    let documentText = "";

    if (input.bytes) {
      const extractedText = await extractDocumentText({
        bytes: input.bytes,
        fileName: input.document.originalFilename,
        fileType: input.document.fileType,
        mimeType: input.document.mimeType,
      });
      documentText = extractedText.text;
    }

    const extraction = await runDocumentExtraction({
      jobId: activeJobId,
      document: input.document,
      documentText,
    });
    const extractedItems = extraction.items;

    const insertedItems = await saveLocalExtractedWorkflowItems(extractedItems);
    const candidates = await getLocalVerifiedProductCandidates();
    const matches = matchExtractedItemsToVerifiedProducts(insertedItems, candidates);
    await applyLocalProductMatches(matches.map((match) => ({
      extractedItemId: match.extractedItemId,
      matchedProductId: match.matchedProductId,
      matchStatus: match.matchStatus,
      matchConfidenceScore: match.matchConfidenceScore,
      matchReason: match.matchReason,
    })));
    await updateLocalDocumentExtractionJob(activeJobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    await updateLocalUploadedDocumentStatus(input.document.id, "completed");
  } catch (error) {
    await updateLocalDocumentExtractionJob(activeJobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Placeholder extraction failed.",
      completedAt: new Date().toISOString(),
    });
    await updateLocalUploadedDocumentStatus(input.document.id, "failed");
  }
}

export async function createDocumentAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  let upload: Awaited<ReturnType<typeof prepareProjectDocument>>;

  try {
    upload = await prepareProjectDocument(formData);
  } catch {
    redirect("/builder/projects?error=invalid-document-upload");
  }

  const name = getOptional(formData, "name") || upload?.fileName || "Project document";
  const documentType = getRequired(formData, "documentType");
  const storagePath = getOptional(formData, "storagePath") || upload?.storagePath || `pending/${name}`;
  const visibleToClient = formData.get("visibleToClient") === "on";
  const context = await getBuilderContext();

  if (context) {
    const { data: project, error: projectError } = await context.supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("organisation_id", context.organisationId)
      .single();

    if (projectError || !project) {
      redirect("/builder/projects?error=project-not-found");
    }

    if (upload) {
      const { error: uploadError } = await context.supabase.storage
        .from("handover-documents")
        .upload(storagePath, upload.bytes, {
          contentType: upload.type,
          upsert: false,
        });

      if (uploadError) {
        redirect("/builder/projects?error=upload-document-failed");
      }
    }

    let uploadedDocumentId: string | null = null;

    if (upload) {
      const { data: uploadedDocument, error: uploadedDocumentError } = await context.supabase
        .from("uploaded_documents")
        .insert({
          project_id: projectId,
          original_filename: upload.fileName,
          file_type: upload.fileType,
          mime_type: upload.type,
          storage_path: storagePath,
          processing_status: "uploaded",
          uploaded_by: context.userId,
        })
        .select("id")
        .single();

      if (uploadedDocumentError || !uploadedDocument) {
        redirect("/builder/projects?error=create-uploaded-document-failed");
      }

      uploadedDocumentId = uploadedDocument.id;
    }

    const { error } = await context.supabase.from("documents").insert({
      project_id: projectId,
      uploaded_by: context.userId,
      name,
      document_type: documentType,
      storage_path: storagePath,
      mime_type: upload?.type || null,
      size_bytes: upload?.size || null,
      visible_to_client: visibleToClient,
    });

    if (error) {
      redirect("/builder/projects?error=create-document-failed");
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      project_id: projectId,
      actor_user_id: context.userId,
      action: "Document registered",
      detail: `Registered ${name}.`,
    });

    if (upload) {
      const { error: auditLogError } = await context.supabase.from("audit_logs").insert({
        project_id: projectId,
        actor_user_id: context.userId,
        event_type: "document_uploaded",
        detail: `Uploaded ${upload.fileName}.`,
        metadata: {
          document_name: name,
          document_type: documentType,
          storage_path: storagePath,
          uploaded_document_id: uploadedDocumentId,
          visible_to_client: visibleToClient,
        },
      });

      if (auditLogError) {
        redirect("/builder/projects?error=create-uploaded-document-audit-failed");
      }

      if (uploadedDocumentId) {
        await processSupabaseDocumentExtractionJob(context, {
          bytes: upload.bytes,
          document: {
            id: uploadedDocumentId,
            projectId,
            originalFilename: upload.fileName,
            fileType: upload.fileType,
            mimeType: upload.type,
            storagePath,
          },
        });
      }
    }
  } else if (upload) {
    await saveLocalUpload(storagePath, upload.bytes);
    const uploadedDocument = await saveLocalUploadedDocument({
      projectId,
      originalFilename: upload.fileName,
      fileType: upload.fileType,
      mimeType: upload.type,
      storagePath,
      processingStatus: "uploaded",
      uploadedBy: "local-scaffold",
    });
    await processLocalDocumentExtractionJob({
      bytes: upload.bytes,
      document: {
        id: uploadedDocument.id,
        projectId: uploadedDocument.projectId,
        originalFilename: uploadedDocument.originalFilename,
        fileType: uploadedDocument.fileType,
        mimeType: uploadedDocument.mimeType,
        storagePath: uploadedDocument.storagePath,
      },
    });
  }

  redirect(`/builder/projects?draft=document-saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function retryDocumentExtractionJobAction(formData: FormData) {
  const jobId = getRequired(formData, "jobId");
  const context = await getBuilderContext();

  if (context) {
    const { data: job, error: jobError } = await context.supabase
      .from("document_extraction_jobs")
      .select("id,project_id,uploaded_document_id,status,retry_count")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      redirect("/builder/projects?error=extraction-job-not-found");
    }

    if (job.status !== "failed") {
      redirect("/builder/projects?error=extraction-job-not-retryable");
    }

    const { data: project, error: projectError } = await context.supabase
      .from("projects")
      .select("id")
      .eq("id", job.project_id)
      .eq("organisation_id", context.organisationId)
      .single();

    if (projectError || !project) {
      redirect("/builder/projects?error=project-not-found");
    }

    const { data: document, error: documentError } = await context.supabase
      .from("uploaded_documents")
      .select("id,project_id,original_filename,file_type,mime_type,storage_path")
      .eq("id", job.uploaded_document_id)
      .single();

    if (documentError || !document) {
      redirect("/builder/projects?error=uploaded-document-not-found");
    }

    const { data: blob, error: downloadError } = await context.supabase.storage
      .from("handover-documents")
      .download(document.storage_path);

    if (downloadError || !blob) {
      redirect("/builder/projects?error=uploaded-document-download-failed");
    }

    const bytes = Buffer.from(await blob.arrayBuffer());

    await processSupabaseDocumentExtractionJob(context, {
      bytes,
      jobId: job.id,
      retryCount: Number(job.retry_count || 0) + 1,
      document: {
        id: document.id,
        projectId: document.project_id,
        originalFilename: document.original_filename,
        fileType: document.file_type || undefined,
        mimeType: document.mime_type,
        storagePath: document.storage_path,
      },
    });
  } else {
    const [jobs, documents] = await Promise.all([
      getLocalDocumentExtractionJobs(),
      getLocalUploadedDocuments(),
    ]);
    const job = jobs.find((candidate) => candidate.id === jobId);

    if (!job) {
      redirect("/builder/projects?error=extraction-job-not-found");
    }

    if (job.status !== "failed") {
      redirect("/builder/projects?error=extraction-job-not-retryable");
    }

    const document = documents.find((candidate) => candidate.id === job.uploadedDocumentId);

    if (!document) {
      redirect("/builder/projects?error=uploaded-document-not-found");
    }

    const bytes = await readLocalUpload(document.storagePath);

    await processLocalDocumentExtractionJob({
      bytes,
      jobId: job.id,
      retryCount: job.retryCount + 1,
      document: {
        id: document.id,
        projectId: document.projectId,
        originalFilename: document.originalFilename,
        fileType: document.fileType,
        mimeType: document.mimeType,
        storagePath: document.storagePath,
      },
    });
  }

  redirect(`/builder/projects?draft=extraction-retried&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function approveWorkflowItemAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");
  const now = new Date().toISOString();

  await reviewWorkflowItem(itemId, {
    actionType: "approved_as_correct",
    nextReviewStatus: "approved",
    notes: getOptional(formData, "notes") || "Builder approved extracted item as correct.",
    itemUpdate: {
      reviewStatus: "approved",
      approvedAt: now,
      approvedBy: "__current_user__",
      excludedAt: null,
      exclusionReason: null,
    },
  });
}

export async function editWorkflowItemAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");
  const productName = getRequired(formData, "productName");
  const category = getOptional(formData, "category");

  await reviewWorkflowItem(itemId, {
    actionType: "edited",
    nextReviewStatus: "edited_by_builder",
    notes: getOptional(formData, "notes") || "Builder edited extracted item details.",
    metadata: {
      edited_fields: [
        "product_name",
        "brand",
        "model",
        "category",
        "supplier",
        "location",
        "warranty_text",
        "maintenance_text",
      ],
    },
    itemUpdate: {
      productName,
      brand: getOptional(formData, "brand"),
      model: getOptional(formData, "model"),
      category,
      supplier: getOptional(formData, "supplier"),
      location: getOptional(formData, "location"),
      warrantyText: getOptional(formData, "warrantyText"),
      maintenanceText: getOptional(formData, "maintenanceText"),
      reviewStatus: "edited_by_builder",
      approvedAt: new Date().toISOString(),
      approvedBy: "__current_user__",
      excludedAt: null,
      exclusionReason: null,
    },
  });
}

export async function excludeWorkflowItemAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");
  const reason = getRequired(formData, "exclusionReason");

  await reviewWorkflowItem(itemId, {
    actionType: "excluded",
    nextReviewStatus: "excluded",
    notes: reason,
    itemUpdate: {
      reviewStatus: "excluded",
      approvedAt: null,
      approvedBy: null,
      excludedAt: new Date().toISOString(),
      exclusionReason: reason,
    },
  });
}

export async function markWorkflowItemBuilderSuppliedAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");

  await reviewWorkflowItem(itemId, {
    actionType: "marked_builder_supplied",
    nextReviewStatus: "builder_supplied",
    notes: getOptional(formData, "notes") || "Builder confirmed this item from their own supplied information.",
    itemUpdate: {
      reviewStatus: "builder_supplied",
      approvedAt: new Date().toISOString(),
      approvedBy: "__current_user__",
      excludedAt: null,
      exclusionReason: null,
    },
  });
}

export async function uploadWorkflowItemSupportingDocumentAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");
  const notes = getOptional(formData, "notes") || "Builder uploaded supporting evidence for review.";
  const context = await getBuilderContext();
  let upload: Awaited<ReturnType<typeof prepareProjectDocument>>;

  try {
    upload = await prepareProjectDocument(formData);
  } catch {
    redirectWorkflowReviewError("invalid-document-upload");
  }

  if (!upload) {
    redirectWorkflowReviewError("invalid-document-upload");
  }

  if (context) {
    const item = await getSupabaseWorkflowReviewItem(context, itemId);
    const { error: uploadError } = await context.supabase.storage
      .from("handover-documents")
      .upload(upload.storagePath, upload.bytes, {
        contentType: upload.type,
        upsert: false,
      });

    if (uploadError) {
      redirectWorkflowReviewError("upload-document-failed");
    }

    await recordSupabaseWorkflowReview(context, item, {
      actionType: "supporting_document_uploaded",
      nextReviewStatus: item.reviewStatus,
      notes,
      metadata: {
        file_name: upload.fileName,
        file_type: upload.fileType,
        mime_type: upload.type,
        size_bytes: upload.size,
        storage_path: upload.storagePath,
      },
    });
  } else {
    await saveLocalUpload(upload.storagePath, upload.bytes);
    const item = await getLocalExtractedWorkflowItem(itemId);

    if (!item) {
      redirectWorkflowReviewError("workflow-item-not-found");
    }

    await recordLocalWorkflowReview(itemId, {
      actionType: "supporting_document_uploaded",
      nextReviewStatus: item.reviewStatus,
      notes,
      metadata: {
        file_name: upload.fileName,
        file_type: upload.fileType,
        mime_type: upload.type,
        size_bytes: upload.size,
        storage_path: upload.storagePath,
      },
    });
  }

  redirectWorkflowReviewSuccess();
}

export async function createProductAction(formData: FormData) {
  const productName = getRequired(formData, "productName");
  const category = getRequired(formData, "category");
  const brand = getOptional(formData, "brand");
  const model = getOptional(formData, "model");
  const supplierUrl = getOptional(formData, "supplierUrl");
  const notes = getOptional(formData, "notes");
  const context = await getBuilderContext();

  if (context) {
    const { data: product, error: productError } = await context.supabase
      .from("products")
      .insert({
        canonical_name: productName,
        brand,
        manufacturer: brand,
        category,
      })
      .select("id")
      .single();

    if (productError || !product) {
      redirect("/builder/products?error=create-product-failed");
    }

    const { data: version, error: versionError } = await context.supabase
      .from("product_versions")
      .insert({
        product_id: product.id,
        version_number: 1,
        status: "draft",
        maintenance_requirements: notes,
        confidence_score: model || supplierUrl ? 55 : 22,
        confidence_label: model || supplierUrl ? "low" : "blocked",
        missing_fields: ["Official source URLs", "Warranty period", "Maintenance requirements"],
      })
      .select("id")
      .single();

    if (versionError || !version) {
      redirect("/builder/products?error=create-product-version-failed");
    }

    if (supplierUrl) {
      await context.supabase.from("product_sources").insert({
        product_version_id: version.id,
        title: "Builder supplied URL",
        url: supplierUrl,
        source_type: "supplier_page",
      });
    }
  }

  redirect(`/builder/products?draft=saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function createMaintenanceTaskAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const title = getRequired(formData, "title");
  const dueDate = getRequired(formData, "dueDate");
  const frequency = getOptional(formData, "frequency");
  const relatedProduct = getOptional(formData, "relatedProduct");
  const description = getOptional(formData, "description");
  const requiredForWarranty = formData.get("requiredForWarranty") === "on";
  const context = await getBuilderContext();

  if (context) {
    const { error } = await context.supabase.from("maintenance_tasks").insert({
      project_id: projectId,
      title,
      description,
      due_date: dueDate,
      frequency,
      required_for_warranty: requiredForWarranty,
    });

    if (error) {
      redirect("/builder/maintenance?error=create-maintenance-failed");
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      project_id: projectId,
      actor_user_id: context.userId,
      action: "Maintenance task created",
      detail: `Created ${title}${relatedProduct ? ` for ${relatedProduct}` : ""}.`,
    });
  }

  redirect(`/builder/maintenance?draft=saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function completeMaintenanceTaskAction(formData: FormData) {
  const taskId = getRequired(formData, "taskId");
  const notes = getOptional(formData, "notes");

  if (!hasSupabaseConfig()) {
    redirect("/client/portal?maintenance=completed&storage=stub");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/client/portal");
  }

  const { data: task, error: taskError } = await supabase
    .from("maintenance_tasks")
    .select("id,project_id,title")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    redirect("/client/portal?error=maintenance-task-not-found");
  }

  const { error } = await supabase.from("maintenance_completions").insert({
    maintenance_task_id: task.id,
    completed_by: user.id,
    notes,
  });

  if (error) {
    redirect(`/client/portal?projectId=${task.project_id}&error=maintenance-complete-failed`);
  }

  redirect(`/client/portal?projectId=${task.project_id}&maintenance=completed`);
}

export async function createSpecificationUploadAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const upload = await prepareSpecificationPdf(formData);
  const fileName = getOptional(formData, "fileName") || upload?.fileName || "Project specification.pdf";
  const storagePath = getOptional(formData, "storagePath") || upload?.storagePath || `pending/specifications/${fileName}`;
  const context = await getBuilderContext();

  if (context) {
    if (upload) {
      const { error: uploadError } = await context.supabase.storage
        .from("handover-documents")
        .upload(storagePath, upload.bytes, {
          contentType: upload.type,
          upsert: false,
        });

      if (uploadError) {
        redirect("/builder/specifications?error=upload-specification-failed");
      }
    }

    const { data: specification, error } = await context.supabase
      .from("specification_uploads")
      .insert({
        project_id: projectId,
        uploaded_by: context.userId,
        file_name: fileName,
        storage_path: storagePath,
        status: "uploaded",
      })
      .select("id")
      .single();

    if (error || !specification) {
      redirect("/builder/specifications?error=create-specification-failed");
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      project_id: projectId,
      actor_user_id: context.userId,
      action: "Specification uploaded",
      detail: `Registered specification PDF ${fileName}.`,
    });
  } else if (upload) {
    await saveLocalUpload(storagePath, upload.bytes);
  }

  redirect(`/builder/specifications?draft=saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function acceptExtractedItemAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");
  const context = await getBuilderContext();

  if (context) {
    const { data: item } = await context.supabase
      .from("extracted_handover_items")
      .select("id,specification_upload_id,item_type,title,category,location,extracted_text")
      .eq("id", itemId)
      .single();

    if (!item) {
      redirect("/builder/specifications/review?error=item-not-found");
    }

    const { data: specification } = await context.supabase
      .from("specification_uploads")
      .select("project_id")
      .eq("id", item.specification_upload_id)
      .single();

    if (!specification) {
      redirect("/builder/specifications/review?error=specification-not-found");
    }

    const { error } = await context.supabase
      .from("extracted_handover_items")
      .update({ status: "builder_approved" })
      .eq("id", itemId);

    if (error) {
      redirect("/builder/specifications/review?error=accept-item-failed");
    }

    if (item.item_type === "product") {
      await context.supabase.from("audit_events").insert({
        organisation_id: context.organisationId,
        project_id: specification.project_id,
        actor_user_id: context.userId,
        action: "Project-scoped product approved",
        detail: `${item.title} was approved by the builder for this project only. Platform admin approval is still required before it becomes a global product record.`,
      });
    }

    if (item.item_type === "maintenance") {
      await context.supabase.from("maintenance_tasks").insert({
        project_id: specification.project_id,
        title: item.title,
        description: item.extracted_text,
        due_date: new Date().toISOString().slice(0, 10),
        frequency: "To confirm",
      });
    }

    if (item.item_type === "document") {
      await context.supabase.from("documents").insert({
        project_id: specification.project_id,
        uploaded_by: context.userId,
        name: item.title,
        document_type: "other",
        storage_path: `requested/${item.id}`,
        visible_to_client: false,
      });
    }
  } else {
    await updateLocalExtractedItemStatus(itemId, "builder_approved");
  }

  redirect(`/builder/specifications/review?draft=accepted&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function approveExtractedItemGloballyAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");
  const context = await getBuilderContext();

  if (context) {
    const { data: item } = await context.supabase
      .from("extracted_handover_items")
      .select("id,specification_upload_id,item_type,title,category,location,extracted_text,confidence_score,client_request_id")
      .eq("id", itemId)
      .single();

    if (!item) {
      redirect("/admin/review?error=item-not-found");
    }

    const { data: specification } = await context.supabase
      .from("specification_uploads")
      .select("project_id")
      .eq("id", item.specification_upload_id)
      .single();

    const { error } = await context.supabase
      .from("extracted_handover_items")
      .update({ status: "global_approved" })
      .eq("id", itemId);

    if (error) {
      redirect("/admin/review?error=global-approve-failed");
    }

    if (item.item_type === "product") {
      const enrichment = enrichExtractedProduct({
        id: item.id,
        specificationId: item.specification_upload_id,
        itemType: item.item_type,
        title: item.title,
        category: item.category || "Product",
        location: item.location || "",
        extractedText: item.extracted_text || "",
        matchedExistingRecord: null,
        sourceClientRequestId: item.client_request_id || undefined,
        confidenceScore: item.confidence_score,
        status: "global_approved",
      });
      const { data: product } = await context.supabase
        .from("products")
        .insert({
          canonical_name: item.title,
          brand: enrichment.brand === "Admin approved" ? null : enrichment.brand,
          manufacturer: enrichment.manufacturer,
          category: item.category,
        })
        .select("id")
        .single();

      if (product) {
        const { data: version } = await context.supabase
          .from("product_versions")
          .insert({
            product_id: product.id,
            version_number: 1,
            status: enrichment.status,
            warranty_period: enrichment.warrantyPeriod,
            void_conditions: enrichment.voidConditions,
            maintenance_requirements: enrichment.maintenanceSummary,
            confidence_score: enrichment.confidenceScore,
            confidence_label: enrichment.confidenceLabel,
            missing_fields: enrichment.missingFields,
            approved_by: context.userId,
            approved_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (version && enrichment.sources.length > 0) {
          await context.supabase.from("product_sources").insert(
            enrichment.sources.map((source) => ({
              product_version_id: version.id,
              title: source.title,
              url: source.url,
              source_type: source.sourceType,
              is_official: source.official,
              is_nz_specific: source.nzSpecific,
            })),
          );
        }
      }
    }

    if (item.client_request_id) {
      await context.supabase
        .from("client_requests")
        .update({ status: "global_approved" })
        .eq("id", item.client_request_id);
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      project_id: specification?.project_id,
      actor_user_id: context.userId,
      action: "Global product library approval",
      detail: `${item.title} was approved for reuse in the global product database.`,
    });
  } else {
    const item = await getLocalExtractedItem(itemId);
    await updateLocalExtractedItemStatus(itemId, "global_approved");
    if (item?.itemType === "product") {
      await upsertLocalGlobalProductFromExtractedItem({
        ...item,
        status: "global_approved",
      });
    }
    const linkedClientRequestId =
      item?.sourceClientRequestId ||
      (item?.id.endsWith("-extracted-item") ? item.id.replace(/-extracted-item$/, "") : null);
    if (linkedClientRequestId) {
      await updateLocalClientRequestStatus(linkedClientRequestId, "global_approved");
    }
  }

  redirect(`/admin/review?draft=accepted&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function rejectAdminReviewItemAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");

  if (hasSupabaseConfig()) {
    const context = await getBuilderContext();

    if (!context) {
      redirect("/login");
    }

    const { data: item } = await context.supabase
      .from("extracted_handover_items")
      .select("id,title,client_request_id,specification_uploads(project_id)")
      .eq("id", itemId)
      .single();

    const { error } = await context.supabase
      .from("extracted_handover_items")
      .update({ status: "rejected" })
      .eq("id", itemId);

    if (error) {
      redirect("/admin/review?error=reject-admin-item-failed");
    }

    if (item?.client_request_id) {
      await context.supabase
        .from("client_requests")
        .update({ status: "rejected" })
        .eq("id", item.client_request_id);
    }
  } else {
    const item = await getLocalExtractedItem(itemId);
    await updateLocalExtractedItemStatus(itemId, "rejected");
    const linkedClientRequestId =
      item?.sourceClientRequestId ||
      (item?.id.endsWith("-extracted-item") ? item.id.replace(/-extracted-item$/, "") : null);
    if (linkedClientRequestId) {
      await updateLocalClientRequestStatus(linkedClientRequestId, "rejected");
    }
  }

  redirect(`/admin/review?draft=rejected&storage=${hasSupabaseConfig() ? "supabase" : "local"}`);
}

export async function rejectExtractedItemAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");
  const context = await getBuilderContext();

  if (context) {
    const { error } = await context.supabase
      .from("extracted_handover_items")
      .update({ status: "rejected" })
      .eq("id", itemId);

    if (error) {
      redirect("/builder/specifications/review?error=reject-item-failed");
    }
  } else {
    await updateLocalExtractedItemStatus(itemId, "rejected");
  }

  redirect(`/builder/specifications/review?draft=rejected&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function updateExtractedItemAction(formData: FormData) {
  const itemId = getRequired(formData, "itemId");
  const itemType = parseExtractedItemType(getRequired(formData, "itemType"));
  const title = getRequired(formData, "title");
  const category = getRequired(formData, "category");
  const location = getOptional(formData, "location") || "";
  const extractedText = getRequired(formData, "extractedText");
  const sourceSnippet = getOptional(formData, "sourceSnippet") || undefined;
  const reviewReason = getOptional(formData, "reviewReason") || undefined;
  const sourcePageValue = getOptional(formData, "sourcePage");
  const parsedSourcePage = sourcePageValue ? Number(sourcePageValue) : null;
  const sourcePage =
    parsedSourcePage && Number.isFinite(parsedSourcePage) && parsedSourcePage > 0
      ? Math.round(parsedSourcePage)
      : undefined;
  const confidenceScoreValue = Number(getRequired(formData, "confidenceScore"));
  const confidenceScore = Number.isFinite(confidenceScoreValue)
    ? Math.min(100, Math.max(0, Math.round(confidenceScoreValue)))
    : 50;

  const validationError = validateExtractedItemEdit({
    itemId,
    itemType,
    title,
    category,
    location,
    extractedText,
    sourceSnippet,
    sourcePage,
    reviewReason,
    confidenceScore,
  });

  if (validationError) {
    redirectToExtractedItemEditError(itemId, validationError);
  }
  if (!itemType) {
    redirectToExtractedItemEditError(itemId, "check-required-fields");
  }

  const context = await getBuilderContext();

  if (context) {
    const updatePayload = {
      item_type: itemType,
      title,
      category,
      location,
      extracted_text: extractedText,
      source_snippet: sourceSnippet || null,
      source_page: sourcePage || null,
      review_reason: reviewReason || null,
      confidence_score: confidenceScore,
      status: "edited",
    };
    const { error } = await context.supabase
      .from("extracted_handover_items")
      .update(updatePayload)
      .eq("id", itemId);

    if (error) {
      if (isMissingReviewReasonColumn(error)) {
        const legacyPayload = {
          item_type: updatePayload.item_type,
          title: updatePayload.title,
          category: updatePayload.category,
          location: updatePayload.location,
          extracted_text: updatePayload.extracted_text,
          source_snippet: updatePayload.source_snippet,
          source_page: updatePayload.source_page,
          confidence_score: updatePayload.confidence_score,
          status: updatePayload.status,
        };
        const { error: legacyError } = await context.supabase
          .from("extracted_handover_items")
          .update(legacyPayload)
          .eq("id", itemId);

        if (!legacyError) {
          redirect(`/builder/specifications/review?draft=saved&storage=supabase`);
        }
      }

      redirectToExtractedItemEditError(itemId, "update-item-failed");
    }
  } else {
    await updateLocalExtractedItem({
      itemId,
      itemType,
      title,
      category,
      location,
      extractedText,
      sourceSnippet,
      sourcePage,
      reviewReason,
      confidenceScore,
    });
  }

  redirect(`/builder/specifications/review?draft=saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function publishHandoverPackageAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const context = await getBuilderContext();

  if (context) {
    const { data: acceptedItems } = await context.supabase
      .from("extracted_handover_items")
      .select("id,specification_uploads(project_id)")
      .in("status", ["accepted", "auto_approved", "builder_approved", "global_approved"])
      .eq("specification_uploads.project_id", projectId);

    const { error: projectError } = await context.supabase
      .from("projects")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (projectError) {
      redirect("/builder/projects?error=publish-package-failed");
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      project_id: projectId,
      actor_user_id: context.userId,
      action: "Handover package published",
      detail: `Published ${acceptedItems?.length || 0} package-ready extracted items to the client portal.`,
    });
  } else {
    await publishLocalHandoverPackage(projectId);
  }

  redirect(`/builder/projects?draft=package-published&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function createClientRequestAction(formData: FormData) {
  const submittedProjectId = getOptional(formData, "projectId");
  const projectId = submittedProjectId || (hasSupabaseConfig() ? null : "prj-bayview");
  const requestType = getRequired(formData, "requestType") as "product" | "document" | "maintenance";
  const title = getRequired(formData, "title");
  const location = getOptional(formData, "location") || "";
  const details = getOptional(formData, "details") || "";
  const attachment = formData.get("attachment");
  const attachmentName = attachment instanceof File && attachment.size > 0 ? attachment.name : undefined;

  if (hasSupabaseConfig()) {
    if (!projectId) {
      redirect("/client/request-product?error=no-client-project");
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const confidenceScore = title.length >= 8 && details.length >= 20 ? 55 : 25;
    const { error } = await supabase.from("client_requests").insert({
      project_id: projectId,
      requested_by: user.id,
      request_type: requestType,
      title,
      location,
      details,
      attachment_name: attachmentName,
      status: "admin_review",
      confidence_score: confidenceScore,
    });

    if (error) {
      redirect("/client/request-product?error=create-request-failed");
    }
  } else {
    await saveLocalClientRequest({
      projectId: projectId || "prj-bayview",
      requestType,
      title,
      location,
      details,
      attachmentName,
    });
  }

  redirect(`/client/request-product?draft=saved&storage=${hasSupabaseConfig() ? "supabase" : "local"}`);
}

export async function createBuilderProjectRequestAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const requestType = getRequired(formData, "requestType") as "product" | "document" | "maintenance";
  const title = getRequired(formData, "title");
  const location = getOptional(formData, "location") || "";
  const details = getOptional(formData, "details") || "Builder requested this missing handover item.";
  const confidenceScore = title.length >= 8 && details.length >= 20 ? 55 : 25;
  const context = await getBuilderContext();

  if (context) {
    const { error } = await context.supabase.from("client_requests").insert({
      project_id: projectId,
      requested_by: context.userId,
      request_type: requestType,
      title,
      location,
      details,
      status: "admin_review",
      confidence_score: confidenceScore,
    });

    if (error) {
      redirect("/builder/projects?error=create-request-failed");
    }

    await context.supabase.from("audit_events").insert({
      organisation_id: context.organisationId,
      project_id: projectId,
      actor_user_id: context.userId,
      action: "Builder requested missing item",
      detail: `Requested admin review for ${title}.`,
    });
  } else {
    await saveLocalClientRequest({
      projectId,
      requestType,
      title,
      location,
      details,
    });
  }

  redirect(`/builder/projects?draft=request-sent&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
}

export async function convertClientRequestToReviewAction(formData: FormData) {
  const requestId = getRequired(formData, "requestId");

  if (hasSupabaseConfig()) {
    const context = await getBuilderContext();

    if (!context) {
      redirect("/login");
    }

    const { data: request } = await context.supabase
      .from("client_requests")
      .select("id,project_id,request_type,title,location,details,confidence_score")
      .eq("id", requestId)
      .single();

    if (!request) {
      redirect("/admin/review?error=request-not-found");
    }

    const { data: specification, error: specificationError } = await context.supabase
      .from("specification_uploads")
      .insert({
        project_id: request.project_id,
        uploaded_by: context.userId,
        file_name: `Client request - ${request.title}`,
        storage_path: `client-requests/${request.id}`,
        status: "needs_review",
      })
      .select("id")
      .single();

    if (specificationError || !specification) {
      redirect("/admin/review?error=create-client-request-review-failed");
    }

    const clientRequestItem = {
      specification_upload_id: specification.id,
      item_type: request.request_type,
      title: request.title,
      category: request.request_type === "product" ? "Client requested product" : "Client request",
      location: request.location,
      extracted_text: request.details,
      source_snippet: request.details,
      review_reason: "Created from a client missing-item request and needs admin review before approval.",
      matched_existing_record: null,
      confidence_score: request.confidence_score,
      client_request_id: request.id,
      status: "admin_review",
    };
    const { error: itemError } = await context.supabase.from("extracted_handover_items").insert(clientRequestItem);

    if (itemError) {
      if (isMissingReviewReasonColumn(itemError)) {
        const legacyClientRequestItem = {
          specification_upload_id: clientRequestItem.specification_upload_id,
          item_type: clientRequestItem.item_type,
          title: clientRequestItem.title,
          category: clientRequestItem.category,
          location: clientRequestItem.location,
          extracted_text: clientRequestItem.extracted_text,
          source_snippet: clientRequestItem.source_snippet,
          matched_existing_record: clientRequestItem.matched_existing_record,
          confidence_score: clientRequestItem.confidence_score,
          client_request_id: clientRequestItem.client_request_id,
          status: clientRequestItem.status,
        };
        const { error: legacyItemError } = await context.supabase
          .from("extracted_handover_items")
          .insert(legacyClientRequestItem);

        if (!legacyItemError) {
          await context.supabase
            .from("client_requests")
            .update({ status: "ai_checking" })
            .eq("id", requestId);
          redirect("/admin/review?draft=converted&storage=supabase");
        }
      }

      redirect("/admin/review?error=create-client-request-item-failed");
    }

    await context.supabase
      .from("client_requests")
      .update({ status: "ai_checking" })
      .eq("id", requestId);
  } else {
    const request = await getLocalClientRequest(requestId);

    if (!request) {
      redirect("/admin/review?error=request-not-found");
    }

    await createLocalExtractionFromClientRequest(request);
    await updateLocalClientRequestStatus(requestId, "ai_checking");
  }

  redirect(`/admin/review?draft=saved&storage=${hasSupabaseConfig() ? "supabase" : "local"}`);
}

export async function rejectClientRequestAction(formData: FormData) {
  const requestId = getRequired(formData, "requestId");

  if (hasSupabaseConfig()) {
    const context = await getBuilderContext();

    if (!context) {
      redirect("/login");
    }

    const { error } = await context.supabase
      .from("client_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);

    if (error) {
      redirect("/admin/review?error=reject-client-request-failed");
    }
  } else {
    await updateLocalClientRequestStatus(requestId, "rejected");
  }

  redirect(`/admin/review?draft=rejected&storage=${hasSupabaseConfig() ? "supabase" : "local"}`);
}

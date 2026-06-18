"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prepareProjectDocument, prepareSpecificationPdf, saveLocalUpload } from "@/lib/server/upload-utils";
import {
  createLocalExtractionFromClientRequest,
  getLocalExtractedItem,
  publishLocalHandoverPackage,
  updateLocalExtractedItem,
  updateLocalExtractedItemStatus,
} from "@/lib/server/local-store/specifications";
import {
  getLocalClientRequest,
  saveLocalClientRequest,
  updateLocalClientRequestStatus,
} from "@/lib/server/local-store/client-requests";
import { upsertLocalGlobalProductFromExtractedItem } from "@/lib/server/local-store/products";
import { enrichExtractedProduct } from "@/lib/ai/source-enrichment";
import type { ExtractedHandoverItem } from "@/lib/types";

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

export async function createDocumentAction(formData: FormData) {
  const projectId = getRequired(formData, "projectId");
  const upload = await prepareProjectDocument(formData);
  const name = getOptional(formData, "name") || upload?.fileName || "Project document";
  const documentType = getRequired(formData, "documentType");
  const storagePath = getOptional(formData, "storagePath") || upload?.storagePath || `pending/${name}`;
  const visibleToClient = formData.get("visibleToClient") === "on";
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
        redirect("/builder/projects?error=upload-document-failed");
      }
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
  } else if (upload) {
    await saveLocalUpload(storagePath, upload.bytes);
  }

  redirect(`/builder/projects?draft=document-saved&storage=${hasSupabaseConfig() ? "supabase" : "stub"}`);
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

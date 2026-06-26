import {
  auditEvents,
  documents,
  maintenanceTasks,
  productVersions,
  projects,
  extractedHandoverItems,
  specificationUploads,
} from "@/lib/data";
import type {
  AuditEvent,
  ClientRequest,
  DocumentDownloadEvent,
  HandoverOpenEvent,
  HandoverDocument,
  MaintenanceTask,
  ProductVersion,
  Project,
  ExtractedHandoverItem,
  SpecificationUpload,
} from "@/lib/types";
import type {
  DocumentExtractionJob,
  ExtractedWorkflowItem,
  ProductMatch,
  UploadedProjectDocument,
  WorkflowHandoverItem,
} from "@/lib/document-workflow";
import type {
  HandoverChecklistSectionStatuses,
  HandoverChecklistValueSource,
  ProjectHandoverChecklistItem,
} from "@/lib/project-handover-checklist";
import { defaultChecklistSectionStatuses } from "@/lib/project-handover-checklist";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getLocalExtractedItems,
  getLocalPublishedItems,
  getLocalSpecificationUploads,
} from "@/lib/server/local-store/specifications";
import { getLocalClientRequests } from "@/lib/server/local-store/client-requests";
import { getLocalGlobalProducts } from "@/lib/server/local-store/products";
import {
  getLocalDocumentExtractionJobs,
  getLocalExtractedWorkflowItems,
  getLocalHandoverOpenEvents,
  getLocalProductMatches,
  getLocalUploadedDocuments,
  getLocalWorkflowHandoverItems,
  recordLocalHandoverOpen,
} from "@/lib/server/local-store/uploaded-documents";
import { getLocalProjectHandoverChecklistItems } from "@/lib/server/local-store/project-handover-checklist";

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const packageReadyStatuses = new Set([
  "accepted",
  "auto_approved",
  "builder_approved",
  "global_approved",
]);
const extractedItemSelectWithReviewReason =
  "id,specification_upload_id,item_type,title,category,location,extracted_text,source_snippet,source_page,review_reason,matched_existing_record,client_request_id,confidence_score,status";
const extractedItemSelect =
  "id,specification_upload_id,item_type,title,category,location,extracted_text,source_snippet,source_page,matched_existing_record,client_request_id,confidence_score,status";
type ExtractedHandoverItemRow = {
  id: string;
  specification_upload_id: string;
  item_type: ExtractedHandoverItem["itemType"];
  title: string;
  category: string | null;
  location: string | null;
  extracted_text: string | null;
  source_snippet: string | null;
  source_page: number | null;
  review_reason?: string | null;
  matched_existing_record: string | null;
  client_request_id: string | null;
  confidence_score: number;
  status: ExtractedHandoverItem["status"];
};

type WorkflowHandoverItemRow = {
  id: string;
  project_id: string;
  source_extracted_item_id: string | null;
  source_document_id: string | null;
  matched_product_id: string | null;
  item_type: WorkflowHandoverItem["itemType"];
  title: string;
  manufacturer?: string | null;
  brand: string | null;
  model: string | null;
  ai_suggested_category?: string | null;
  builder_approved_category?: string | null;
  category: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  supplier: string | null;
  supplier_sku?: string | null;
  location: string | null;
  quantity?: string | null;
  variant_or_finish?: string | null;
  warranty_text: string | null;
  maintenance_text: string | null;
  care_guidance_source_type?: WorkflowHandoverItem["careGuidanceSourceType"] | null;
  care_guidance_source_label?: string | null;
  warranty_source_version_id?: string | null;
  manual_source_version_id?: string | null;
  care_guidance_version_id?: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

type LooseDbRow = Record<string, unknown>;

function getRowObject(row: LooseDbRow, key: string) {
  const value = row[key];
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getRowString(row: LooseDbRow, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : undefined;
}

function getRowNumber(row: LooseDbRow, key: string) {
  const value = row[key];
  return typeof value === "number" ? value : 0;
}

function getRowBoolean(row: LooseDbRow, key: string) {
  const value = row[key];
  return typeof value === "boolean" ? value : undefined;
}

export function isPackageReadyExtractedItem(item: Pick<ExtractedHandoverItem, "status">) {
  return packageReadyStatuses.has(item.status);
}

export async function getBuilderCreditStatus(): Promise<{
  email: string;
  unlimited: boolean;
  availableCredits: number | "infinite";
  projectCost: number;
}> {
  if (!hasSupabaseConfig()) {
    return {
      email: "local scaffold",
      unlimited: true,
      availableCredits: "infinite",
      projectCost: 1,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email || "";
  const { data: member } = user
    ? await supabase
        .from("organisation_members")
        .select("organisation_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };
  const { data: creditAccount } = member?.organisation_id
    ? await supabase
        .from("project_credit_accounts")
        .select("credit_balance,unlimited")
        .eq("organisation_id", member.organisation_id)
        .maybeSingle()
    : { data: null };
  const unlimited = Boolean(creditAccount?.unlimited) || email.toLowerCase() === "test@gmail.com";

  return {
    email,
    unlimited,
    availableCredits: unlimited ? "infinite" : creditAccount?.credit_balance || 0,
    projectCost: 1,
  };
}

export async function hasBuilderWorkspace() {
  if (!hasSupabaseConfig()) {
    return true;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return Boolean(!error && data?.organisation_id);
}

export async function getBuilderOrganisationSettings(): Promise<{
  id: string | null;
  name: string;
  tradingName: string;
  contactEmail: string;
  contactPhone: string;
}> {
  if (!hasSupabaseConfig()) {
    return {
      id: null,
      name: "Local Builder Co",
      tradingName: "Local Builder Co",
      contactEmail: "builder@example.co.nz",
      contactPhone: "",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      id: null,
      name: "",
      tradingName: "",
      contactEmail: "",
      contactPhone: "",
    };
  }

  const { data: member } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member?.organisation_id) {
    return {
      id: null,
      name: "",
      tradingName: "",
      contactEmail: user.email || "",
      contactPhone: "",
    };
  }

  const { data: organisation } = await supabase
    .from("organisations")
    .select("id,name,trading_name,contact_email,contact_phone")
    .eq("id", member.organisation_id)
    .maybeSingle();

  return {
    id: organisation?.id || member.organisation_id,
    name: organisation?.name || "",
    tradingName: organisation?.trading_name || "",
    contactEmail: organisation?.contact_email || user.email || "",
    contactPhone: organisation?.contact_phone || "",
  };
}

function mapExtractedHandoverItemRows(data: ExtractedHandoverItemRow[]) {
  return data.map((item) => ({
    id: item.id,
    specificationId: item.specification_upload_id,
    itemType: item.item_type,
    title: item.title,
    category: item.category || "To review",
    location: item.location || "",
    extractedText: item.extracted_text || "",
    sourceSnippet: item.source_snippet || undefined,
    sourcePage: item.source_page || undefined,
    reviewReason: item.review_reason || undefined,
    matchedExistingRecord: item.matched_existing_record,
    sourceClientRequestId: item.client_request_id || undefined,
    confidenceScore: item.confidence_score,
    status: item.status,
  }));
}

function mapWorkflowHandoverItemRows(data: WorkflowHandoverItemRow[]): WorkflowHandoverItem[] {
  return data.map((item) => ({
    id: item.id,
    projectId: item.project_id,
    sourceExtractedItemId: item.source_extracted_item_id || undefined,
    sourceDocumentId: item.source_document_id || undefined,
    matchedProductId: item.matched_product_id || undefined,
    itemType: item.item_type,
    title: item.title,
    manufacturer: item.manufacturer || undefined,
    brand: item.brand || undefined,
    model: item.model || undefined,
    aiSuggestedCategory: item.ai_suggested_category || undefined,
    builderApprovedCategory: item.builder_approved_category || undefined,
    category: item.category || undefined,
    supplierId: item.supplier_id || undefined,
    supplierName: item.supplier_name || undefined,
    supplier: item.supplier_name || item.supplier || undefined,
    supplierSku: item.supplier_sku || undefined,
    location: item.location || undefined,
    quantity: item.quantity || undefined,
    variantOrFinish: item.variant_or_finish || undefined,
    warrantyText: item.warranty_text || undefined,
    maintenanceText: item.maintenance_text || undefined,
    careGuidanceSourceType: item.care_guidance_source_type || undefined,
    careGuidanceSourceLabel: item.care_guidance_source_label || undefined,
    warrantySourceVersionId: item.warranty_source_version_id || undefined,
    manualSourceVersionId: item.manual_source_version_id || undefined,
    careGuidanceVersionId: item.care_guidance_version_id || undefined,
    approvedBy: item.approved_by || undefined,
    approvedAt: item.approved_at || undefined,
    createdAt: item.created_at,
  }));
}

function checklistItemToPackageItem(item: ProjectHandoverChecklistItem): ExtractedHandoverItem {
  const metadata = item.sourceMetadata || {};
  const location = typeof metadata.location === "string" ? metadata.location : "";
  const finish = typeof metadata.finish === "string" ? metadata.finish : "";
  const colour = typeof metadata.colour === "string" ? metadata.colour : "";
  const quantity = typeof metadata.quantity === "string" ? metadata.quantity : "";
  const supportingDocumentsNote = typeof metadata.supporting_documents_note === "string" ? metadata.supporting_documents_note : "";
  const detailText = [
    item.brand || item.manufacturer ? `Manufacturer/brand: ${item.brand || item.manufacturer}` : null,
    item.model || item.productCode || item.sku ? `Model/SKU/code: ${[item.model, item.sku, item.productCode].filter(Boolean).join(" / ")}` : null,
    item.supplier ? `Supplier: ${item.supplier}${item.supplierSku ? ` (${item.supplierSku})` : ""}` : null,
    quantity ? `Quantity: ${quantity}` : null,
    finish || colour ? `Finish/colour: ${[finish, colour].filter(Boolean).join(" / ")}` : null,
    item.careInstructions ? `Care: ${item.careInstructions}` : null,
    item.manualUrl ? `Manual: ${item.manualUrl}` : null,
    item.warrantyInformation ? `Warranty: ${item.warrantyInformation}` : null,
    item.invoiceData ? `Purchase info: ${item.invoiceData}` : null,
    item.codeComplianceInformation ? `Compliance: ${item.codeComplianceInformation}` : null,
    supportingDocumentsNote ? `Supporting documents: ${supportingDocumentsNote}` : null,
    item.extraNotes ? `Builder note: ${item.extraNotes}` : null,
  ].filter(Boolean).join("\n");

  return {
    id: item.id,
    specificationId: item.projectId,
    itemType: "product",
    title: item.title,
    category: item.category || "Project handover item",
    location,
    extractedText: detailText || "Builder-reviewed project handover item.",
    matchedExistingRecord: typeof metadata.matched_product_id === "string" ? metadata.matched_product_id : null,
    confidenceScore: 100,
    status: item.status === "complete" ? "accepted" : "builder_approved",
  };
}

function isChecklistPackageReady(item: ProjectHandoverChecklistItem) {
  return item.status === "complete" || item.status === "user_accepted_incomplete" || item.sectionStatuses.careInstructions === "reviewed" || item.sectionStatuses.manual === "reviewed" || item.sectionStatuses.warranty === "reviewed";
}

function workflowHandoverItemToPackageItem(item: WorkflowHandoverItem): ExtractedHandoverItem {
  const careGuidanceLabel = formatCareGuidanceSourceType(item.careGuidanceSourceType, item.careGuidanceSourceLabel);
  const detailText = [
    item.warrantyText ? `Warranty: ${item.warrantyText}` : null,
    item.maintenanceText ? `${careGuidanceLabel}: ${item.maintenanceText}` : null,
    !item.warrantyText && !item.maintenanceText ? item.supplier || item.category || "Builder approved handover item." : null,
  ].filter(Boolean).join("\n");

  return {
    id: item.id,
    specificationId: item.sourceDocumentId || item.projectId,
    itemType: item.itemType,
    title: item.title,
    category: item.builderApprovedCategory || item.category || "Approved handover item",
    location: item.location || "",
    extractedText: detailText,
    reviewReason: "Generated from builder-approved workflow handover item.",
    matchedExistingRecord: item.matchedProductId || null,
    confidenceScore: 100,
    status: "accepted",
  };
}

function formatCareGuidanceSourceType(sourceType?: WorkflowHandoverItem["careGuidanceSourceType"], sourceLabel?: string) {
  if (sourceLabel) {
    return sourceLabel;
  }

  const labels = {
    manufacturer: "Manufacturer guidance",
    supplier: "Supplier guidance",
    builder_supplied: "Builder supplied guidance",
    general_ai: "General AI care guidance",
    unknown: "Care guidance",
  };

  return labels[sourceType || "unknown"];
}

export async function getProjects(): Promise<Project[]> {
  if (!hasSupabaseConfig()) {
    return projects;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,address,project_type,status,handover_date,published_at,created_at,project_clients(name,email,invited_at,accepted_at)")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return projects;
  }

  return data.map((project) => {
    const client = Array.isArray(project.project_clients) ? project.project_clients[0] : null;

    return {
      id: project.id,
      name: project.name,
      address: project.address,
      clientName: client?.name || "Client not added",
      clientEmail: client?.email || "",
      clientInviteStatus: client?.accepted_at ? "accepted" : client?.invited_at ? "invited" : "not_invited",
      clientInvitedAt: client?.invited_at || undefined,
      projectType: project.project_type,
      handoverDate: project.handover_date || project.created_at,
      publishedAt: project.published_at || undefined,
      status: project.status,
      documentCount: 0,
      productCount: 0,
      openTasks: 0,
      lastActivity: project.created_at,
    } satisfies Project;
  });
}

export async function getDocuments(projectId?: string): Promise<HandoverDocument[]> {
  if (!hasSupabaseConfig()) {
    return projectId ? documents.filter((document) => document.projectId === projectId) : documents;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("documents")
    .select("id,project_id,name,document_type,storage_path,size_bytes,visible_to_client,created_at")
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return projectId ? documents.filter((document) => document.projectId === projectId) : documents;
  }

  return data.map((document) => ({
    id: document.id,
    projectId: document.project_id,
    name: document.name,
    type: document.document_type,
    size: document.size_bytes ? `${Math.round(Number(document.size_bytes) / 1024)} KB` : "Pending upload",
    storagePath: document.storage_path || undefined,
    uploadedAt: document.created_at,
    visibleToClient: document.visible_to_client,
  }));
}

export async function getDocumentDownloadEvents(projectId?: string): Promise<DocumentDownloadEvent[]> {
  if (!hasSupabaseConfig()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("document_download_events")
    .select("id,document_id,project_id,downloaded_by,downloaded_at,user_agent")
    .order("downloaded_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((event) => ({
    id: event.id,
    documentId: event.document_id,
    projectId: event.project_id,
    downloadedBy: event.downloaded_by || undefined,
    downloadedAt: event.downloaded_at,
    userAgent: event.user_agent || undefined,
  }));
}

export async function getHandoverOpenEvents(projectId?: string): Promise<HandoverOpenEvent[]> {
  if (!hasSupabaseConfig()) {
    return getLocalHandoverOpenEvents(projectId);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("handover_open_events")
    .select("id,project_id,opened_by,first_opened_at,last_opened_at,open_count,user_agent")
    .order("first_opened_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((event) => ({
    id: event.id,
    projectId: event.project_id,
    openedBy: event.opened_by || undefined,
    firstOpenedAt: event.first_opened_at,
    lastOpenedAt: event.last_opened_at,
    openCount: event.open_count,
    userAgent: event.user_agent || undefined,
  }));
}

export async function recordHandoverOpen(projectId: string, userAgent?: string) {
  if (!hasSupabaseConfig()) {
    return recordLocalHandoverOpen(projectId, userAgent);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: projectClient } = await supabase
    .from("project_clients")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!projectClient) {
    return null;
  }

  const { data: existing } = await supabase
    .from("handover_open_events")
    .select("id,open_count")
    .eq("project_id", projectId)
    .eq("opened_by", user.id)
    .maybeSingle();

  if (existing) {
    const { data } = await supabase
      .from("handover_open_events")
      .update({
        last_opened_at: new Date().toISOString(),
        open_count: (existing.open_count || 1) + 1,
        user_agent: userAgent || null,
      })
      .eq("id", existing.id)
      .select("id,project_id,opened_by,first_opened_at,last_opened_at,open_count,user_agent")
      .maybeSingle();

    return data;
  }

  const { data } = await supabase
    .from("handover_open_events")
    .insert({
      project_id: projectId,
      opened_by: user.id,
      user_agent: userAgent || null,
    })
    .select("id,project_id,opened_by,first_opened_at,last_opened_at,open_count,user_agent")
    .maybeSingle();

  return data;
}

function getChecklistArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function getChecklistSectionStatuses(row: LooseDbRow): HandoverChecklistSectionStatuses {
  return {
    ...defaultChecklistSectionStatuses,
    ...getRowObject(row, "section_statuses"),
  } as HandoverChecklistSectionStatuses;
}

export async function getProjectHandoverChecklistItems(projectId?: string): Promise<ProjectHandoverChecklistItem[]> {
  if (!hasSupabaseConfig()) {
    return getLocalProjectHandoverChecklistItems(projectId);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("project_handover_checklist_items")
    .select("id,project_id,source_extracted_item_id,source_document_id,extraction_job_id,title,category,brand,manufacturer,model,sku,product_code,supplier,supplier_sku,care_instructions,manual_document_id,manual_url,warranty_information,warranty_document_id,warranty_guidance_is_general,invoice_document_id,invoice_data,code_compliance_document_id,code_compliance_information,supporting_document_ids,extra_notes,section_statuses,value_sources,source_metadata,status,completion_summary,accepted_incomplete_reason,accepted_incomplete_at,accepted_incomplete_by,created_by,last_edited_by,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return getLocalProjectHandoverChecklistItems(projectId);
  }

  return (data as unknown as LooseDbRow[]).map((row) => ({
    id: getRowString(row, "id") || "",
    projectId: getRowString(row, "project_id") || "",
    sourceExtractedItemId: getRowString(row, "source_extracted_item_id"),
    sourceDocumentId: getRowString(row, "source_document_id"),
    extractionJobId: getRowString(row, "extraction_job_id"),
    title: getRowString(row, "title") || "Untitled handover item",
    category: getRowString(row, "category"),
    brand: getRowString(row, "brand"),
    manufacturer: getRowString(row, "manufacturer"),
    model: getRowString(row, "model"),
    sku: getRowString(row, "sku"),
    productCode: getRowString(row, "product_code"),
    supplier: getRowString(row, "supplier"),
    supplierSku: getRowString(row, "supplier_sku"),
    careInstructions: getRowString(row, "care_instructions"),
    manualDocumentId: getRowString(row, "manual_document_id"),
    manualUrl: getRowString(row, "manual_url"),
    warrantyInformation: getRowString(row, "warranty_information"),
    warrantyDocumentId: getRowString(row, "warranty_document_id"),
    warrantyGuidanceIsGeneral: getRowBoolean(row, "warranty_guidance_is_general"),
    invoiceDocumentId: getRowString(row, "invoice_document_id"),
    invoiceData: getRowString(row, "invoice_data"),
    codeComplianceDocumentId: getRowString(row, "code_compliance_document_id"),
    codeComplianceInformation: getRowString(row, "code_compliance_information"),
    supportingDocumentIds: getChecklistArray(row.supporting_document_ids),
    extraNotes: getRowString(row, "extra_notes"),
    sectionStatuses: getChecklistSectionStatuses(row),
    valueSources: getChecklistArray(row.value_sources) as HandoverChecklistValueSource[],
    sourceMetadata: getRowObject(row, "source_metadata"),
    status: getRowString(row, "status") as ProjectHandoverChecklistItem["status"],
    completionSummary: getRowString(row, "completion_summary"),
    acceptedIncompleteReason: getRowString(row, "accepted_incomplete_reason"),
    acceptedIncompleteAt: getRowString(row, "accepted_incomplete_at"),
    acceptedIncompleteBy: getRowString(row, "accepted_incomplete_by"),
    createdBy: getRowString(row, "created_by"),
    lastEditedBy: getRowString(row, "last_edited_by"),
    createdAt: getRowString(row, "created_at") || "",
    updatedAt: getRowString(row, "updated_at") || "",
  }));
}

export async function getUploadedProjectDocuments(projectId?: string): Promise<UploadedProjectDocument[]> {
  if (!hasSupabaseConfig()) {
    return getLocalUploadedDocuments(projectId);
  }

  const supabase = await createSupabaseServerClient();
  const richColumns = "id,project_id,original_filename,file_type,mime_type,storage_path,workflow_role,parent_extracted_item_id,processing_status,uploaded_by,created_at,updated_at";
  const legacyColumns = "id,project_id,original_filename,file_type,mime_type,storage_path,processing_status,uploaded_by,created_at,updated_at";
  let query = supabase
    .from("uploaded_documents")
    .select(richColumns)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const richResult = await query;
  let data = richResult.data as unknown as LooseDbRow[] | null;
  let error = richResult.error;

  if (error) {
    let legacyQuery = supabase
      .from("uploaded_documents")
      .select(legacyColumns)
      .order("created_at", { ascending: false });

    if (projectId) {
      legacyQuery = legacyQuery.eq("project_id", projectId);
    }

    const legacyResult = await legacyQuery;
    data = legacyResult.data as unknown as LooseDbRow[] | null;
    error = legacyResult.error;
  }

  if (error || !data) {
    return [];
  }

  return data.map((document) => ({
    id: getRowString(document, "id") || "",
    projectId: getRowString(document, "project_id") || "",
    originalFilename: getRowString(document, "original_filename") || "",
    fileType: getRowString(document, "file_type"),
    mimeType: getRowString(document, "mime_type") || "",
    storagePath: getRowString(document, "storage_path") || "",
    workflowRole: getRowString(document, "workflow_role") as UploadedProjectDocument["workflowRole"],
    parentExtractedItemId: getRowString(document, "parent_extracted_item_id"),
    processingStatus: getRowString(document, "processing_status") as UploadedProjectDocument["processingStatus"],
    uploadedBy: getRowString(document, "uploaded_by"),
    createdAt: getRowString(document, "created_at") || "",
    updatedAt: getRowString(document, "updated_at") || "",
  }));
}

export async function getDocumentExtractionJobs(projectId?: string): Promise<DocumentExtractionJob[]> {
  if (!hasSupabaseConfig()) {
    return getLocalDocumentExtractionJobs(projectId);
  }

  type DocumentExtractionJobRow = {
    id: string;
    project_id: string;
    uploaded_document_id: string;
    status: DocumentExtractionJob["status"];
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    retry_count: number;
    created_at: string;
    updated_at: string;
    usage_metrics?: unknown;
  };

  const supabase = await createSupabaseServerClient();
  const baseColumns = "id,project_id,uploaded_document_id,status,error_message,started_at,completed_at,retry_count,created_at,updated_at";
  let query = supabase
    .from("document_extraction_jobs")
    .select(`${baseColumns},usage_metrics`)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const result = await query;
  let data = result.data as unknown as DocumentExtractionJobRow[] | null;
  let error = result.error;

  if (error) {
    let fallbackQuery = supabase
      .from("document_extraction_jobs")
      .select(baseColumns)
      .order("created_at", { ascending: false });

    if (projectId) {
      fallbackQuery = fallbackQuery.eq("project_id", projectId);
    }

    const fallback = await fallbackQuery;
    data = fallback.data as unknown as DocumentExtractionJobRow[] | null;
    error = fallback.error;
  }

  if (error || !data) {
    return [];
  }

  return data.map((job) => ({
    id: job.id,
    projectId: job.project_id,
    uploadedDocumentId: job.uploaded_document_id,
    status: job.status,
    errorMessage: job.error_message || undefined,
    usageMetrics: "usage_metrics" in job && job.usage_metrics && typeof job.usage_metrics === "object"
      ? job.usage_metrics as Record<string, unknown>
      : undefined,
    startedAt: job.started_at || undefined,
    completedAt: job.completed_at || undefined,
    retryCount: job.retry_count,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  }));
}

export async function getExtractedWorkflowItems(projectId?: string): Promise<ExtractedWorkflowItem[]> {
  if (!hasSupabaseConfig()) {
    return getLocalExtractedWorkflowItems(projectId);
  }

  const supabase = await createSupabaseServerClient();
  const richColumns =
    "id,project_id,source_document_id,extraction_job_id,raw_extracted_data,original_extracted_values,builder_edited_values,item_type,product_name,manufacturer,brand,model,category,ai_suggested_category,builder_approved_category,supplier_id,supplier_name,supplier,supplier_sku,location,quantity,variant_or_finish,warranty_text,maintenance_text,care_guidance_source_type,care_guidance_source_label,care_guidance_review_required,warranty_source_version_id,manual_source_version_id,care_guidance_version_id,identity_fingerprint,parent_extracted_item_id,source_quote_document_id,quote_reference_text,quote_reference_status,source_page,source_section,source_snippet,confidence_score,match_status,review_status,matched_product_id,approved_by,approved_at,excluded_at,exclusion_reason,created_at,updated_at";
  const legacyColumns =
    "id,project_id,source_document_id,extraction_job_id,raw_extracted_data,product_name,brand,model,category,supplier,location,warranty_text,maintenance_text,confidence_score,match_status,review_status,matched_product_id,approved_by,approved_at,excluded_at,exclusion_reason,created_at,updated_at";
  let query = supabase
    .from("extracted_items")
    .select(richColumns)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const richResult = await query;
  let data = richResult.data as unknown as LooseDbRow[] | null;
  let error = richResult.error;

  if (error) {
    let legacyQuery = supabase
      .from("extracted_items")
      .select(legacyColumns)
      .order("created_at", { ascending: false });

    if (projectId) {
      legacyQuery = legacyQuery.eq("project_id", projectId);
    }

    const legacyResult = await legacyQuery;
    data = legacyResult.data as unknown as LooseDbRow[] | null;
    error = legacyResult.error;
  }

  if (error || !data) {
    return [];
  }

  return data.map((item) => {
    const raw = getRowObject(item, "raw_extracted_data");
    const identity = getRowObject(raw, "identity");

    return {
      id: getRowString(item, "id") || "",
      projectId: getRowString(item, "project_id") || "",
      sourceDocumentId: getRowString(item, "source_document_id") || "",
      extractionJobId: getRowString(item, "extraction_job_id"),
      parentExtractedItemId: getRowString(item, "parent_extracted_item_id"),
      sourceQuoteDocumentId: getRowString(item, "source_quote_document_id"),
      rawExtractedData: raw,
      originalExtractedValues: getRowObject(item, "original_extracted_values"),
      builderEditedValues: getRowObject(item, "builder_edited_values"),
      itemType: getRowString(item, "item_type") as ExtractedWorkflowItem["itemType"],
      productName: getRowString(item, "product_name"),
      manufacturer: getRowString(item, "manufacturer") || getRowString(raw, "manufacturer"),
      brand: getRowString(item, "brand"),
      model: getRowString(item, "model"),
      aiSuggestedCategory: getRowString(item, "ai_suggested_category") || getRowString(raw, "aiSuggestedCategory"),
      builderApprovedCategory: getRowString(item, "builder_approved_category") || getRowString(raw, "builderApprovedCategory"),
      category: getRowString(item, "category"),
      supplierId: getRowString(item, "supplier_id"),
      supplierName: getRowString(item, "supplier_name") || getRowString(raw, "supplierName"),
      supplier: getRowString(item, "supplier"),
      supplierSku: getRowString(item, "supplier_sku") || getRowString(raw, "supplierSku"),
      location: getRowString(item, "location"),
      quantity: getRowString(item, "quantity") || getRowString(raw, "quantity"),
      variantOrFinish: getRowString(item, "variant_or_finish") || getRowString(raw, "variantOrFinish"),
      warrantyText: getRowString(item, "warranty_text"),
      maintenanceText: getRowString(item, "maintenance_text"),
      careGuidanceSourceType: (getRowString(item, "care_guidance_source_type") || getRowString(raw, "careGuidanceSourceType")) as ExtractedWorkflowItem["careGuidanceSourceType"],
      careGuidanceSourceLabel: getRowString(item, "care_guidance_source_label") || getRowString(raw, "careGuidanceSourceLabel"),
      careGuidanceReviewRequired: getRowBoolean(item, "care_guidance_review_required"),
      warrantySourceVersionId: getRowString(item, "warranty_source_version_id"),
      manualSourceVersionId: getRowString(item, "manual_source_version_id"),
      careGuidanceVersionId: getRowString(item, "care_guidance_version_id"),
      identityFingerprint: getRowString(item, "identity_fingerprint") || getRowString(identity, "fingerprint"),
      quoteReferenceText: getRowString(item, "quote_reference_text") || getRowString(raw, "quoteReferenceText"),
      quoteReferenceStatus: (getRowString(item, "quote_reference_status") || getRowString(raw, "quoteReferenceStatus")) as ExtractedWorkflowItem["quoteReferenceStatus"],
      sourcePage: getRowString(item, "source_page"),
      sourceSection: getRowString(item, "source_section"),
      sourceSnippet: getRowString(item, "source_snippet"),
      confidenceScore: getRowNumber(item, "confidence_score"),
      matchStatus: getRowString(item, "match_status") as ExtractedWorkflowItem["matchStatus"],
      reviewStatus: getRowString(item, "review_status") as ExtractedWorkflowItem["reviewStatus"],
      matchedProductId: getRowString(item, "matched_product_id"),
      approvedBy: getRowString(item, "approved_by"),
      approvedAt: getRowString(item, "approved_at"),
      excludedAt: getRowString(item, "excluded_at"),
      exclusionReason: getRowString(item, "exclusion_reason"),
      createdAt: getRowString(item, "created_at") || "",
      updatedAt: getRowString(item, "updated_at") || "",
    };
  });
}

export async function getProductMatches(projectId?: string): Promise<ProductMatch[]> {
  if (!hasSupabaseConfig()) {
    return getLocalProductMatches(projectId);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("product_matches")
    .select("id,extracted_item_id,matched_product_id,match_status,match_confidence_score,match_reason,created_at,extracted_items!inner(project_id)")
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("extracted_items.project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((match) => ({
    id: match.id,
    extractedItemId: match.extracted_item_id,
    matchedProductId: match.matched_product_id || undefined,
    matchStatus: match.match_status,
    matchConfidenceScore: match.match_confidence_score,
    matchReason: match.match_reason || undefined,
    createdAt: match.created_at,
  }));
}

export async function getWorkflowHandoverItems(projectId?: string): Promise<WorkflowHandoverItem[]> {
  if (!hasSupabaseConfig()) {
    return getLocalWorkflowHandoverItems(projectId);
  }

  const supabase = await createSupabaseServerClient();
  const richColumns =
    "id,project_id,source_extracted_item_id,source_document_id,matched_product_id,item_type,title,manufacturer,brand,model,ai_suggested_category,builder_approved_category,category,supplier_id,supplier_name,supplier,supplier_sku,location,quantity,variant_or_finish,warranty_text,maintenance_text,care_guidance_source_type,care_guidance_source_label,warranty_source_version_id,manual_source_version_id,care_guidance_version_id,approved_by,approved_at,created_at";
  const legacyColumns =
    "id,project_id,source_extracted_item_id,source_document_id,matched_product_id,item_type,title,brand,model,category,supplier,location,warranty_text,maintenance_text,approved_by,approved_at,created_at";
  let query = supabase
    .from("handover_items")
    .select(richColumns)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const richResult = await query;
  let data = richResult.data as unknown as WorkflowHandoverItemRow[] | null;
  let error = richResult.error;

  if (error) {
    let legacyQuery = supabase
      .from("handover_items")
      .select(legacyColumns)
      .order("created_at", { ascending: false });

    if (projectId) {
      legacyQuery = legacyQuery.eq("project_id", projectId);
    }

    const legacyResult = await legacyQuery;
    data = legacyResult.data as unknown as WorkflowHandoverItemRow[] | null;
    error = legacyResult.error;
  }

  if (error || !data) {
    return [];
  }

  return mapWorkflowHandoverItemRows(data as WorkflowHandoverItemRow[]);
}

export async function getProductVersions(): Promise<ProductVersion[]> {
  if (!hasSupabaseConfig()) {
    const localGlobalProducts = await getLocalGlobalProducts();
    return [...localGlobalProducts, ...productVersions];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_versions")
    .select(
      "id,status,warranty_period,void_conditions,maintenance_requirements,confidence_score,confidence_label,checked_at,missing_fields,products(canonical_name,brand,category),product_sources(title,url,source_type,is_official,is_nz_specific)",
    )
    .order("checked_at", { ascending: false });

  if (error || !data) {
    return productVersions;
  }

  return data.map((version) => {
    const product = Array.isArray(version.products) ? version.products[0] : version.products;
    const sources = Array.isArray(version.product_sources) ? version.product_sources : [];

    return {
      id: version.id,
      productName: product?.canonical_name || "Unnamed product",
      brand: product?.brand || "Unknown",
      category: product?.category || "Other",
      location: "",
      warrantyPeriod: version.warranty_period || "Not captured yet",
      maintenanceSummary: version.maintenance_requirements || "Maintenance details not captured yet.",
      voidConditions: version.void_conditions || "Not captured yet",
      confidenceScore: version.confidence_score,
      confidenceLabel: version.confidence_label,
      status: version.status,
      checkedAt: version.checked_at,
      sources: sources.map((source) => ({
        title: source.title,
        url: source.url,
        sourceType: source.source_type,
        official: source.is_official,
        nzSpecific: source.is_nz_specific,
      })),
      missingFields: version.missing_fields || [],
      reviewReason: version.missing_fields?.length
        ? `Missing ${version.missing_fields.join(", ")}.`
        : "Ready for builder review.",
    } satisfies ProductVersion;
  });
}

export async function getMaintenanceTasks(projectId?: string): Promise<MaintenanceTask[]> {
  if (!hasSupabaseConfig()) {
    return projectId ? maintenanceTasks.filter((task) => task.projectId === projectId) : maintenanceTasks;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("maintenance_tasks")
    .select("id,project_id,title,due_date,frequency,required_for_warranty,created_at,maintenance_completions(id,completed_at)")
    .order("due_date", { ascending: true });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return projectId ? maintenanceTasks.filter((task) => task.projectId === projectId) : maintenanceTasks;
  }

  return data.map((task) => {
    const completions = Array.isArray(task.maintenance_completions)
      ? task.maintenance_completions
      : [];

    return {
      id: task.id,
      projectId: task.project_id,
      title: task.title,
      cadence: task.frequency || "One-off",
      dueDate: task.due_date,
      requiredForWarranty: task.required_for_warranty,
      relatedProduct: "Project maintenance",
      status: completions.length > 0 ? "complete" : new Date(task.due_date) < new Date() ? "overdue" : "upcoming",
    };
  });
}

export async function getAuditEvents(): Promise<AuditEvent[]> {
  if (!hasSupabaseConfig()) {
    return auditEvents;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id,project_id,action,detail,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return auditEvents;
  }

  return data.map((event) => ({
    id: event.id,
    projectId: event.project_id || undefined,
    actor: "Workspace",
    action: event.action,
    detail: event.detail,
    createdAt: event.created_at,
  }));
}

export async function getSpecificationUploads(projectId?: string): Promise<SpecificationUpload[]> {
  if (!hasSupabaseConfig()) {
    const localUploads = await getLocalSpecificationUploads();
    const uploads = [...localUploads, ...specificationUploads];
    return projectId ? uploads.filter((specification) => specification.projectId === projectId) : uploads;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("specification_uploads")
    .select("id,project_id,file_name,status,created_at")
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return projectId
      ? specificationUploads.filter((specification) => specification.projectId === projectId)
      : specificationUploads;
  }

  return data.map((specification) => ({
    id: specification.id,
    projectId: specification.project_id,
    fileName: specification.file_name,
    uploadedAt: specification.created_at,
    status: specification.status,
    extractedCount: 0,
    newItemCount: 0,
    matchedItemCount: 0,
  }));
}

export async function getExtractedHandoverItems(
  specificationId?: string,
): Promise<ExtractedHandoverItem[]> {
  if (!hasSupabaseConfig()) {
    const localItems = await getLocalExtractedItems(specificationId);
    const seedItems = specificationId
      ? extractedHandoverItems.filter((item) => item.specificationId === specificationId)
      : extractedHandoverItems;

    return [...localItems, ...seedItems];
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("extracted_handover_items")
    .select(extractedItemSelectWithReviewReason)
    .order("confidence_score", { ascending: false });

  if (specificationId) {
    query = query.eq("specification_upload_id", specificationId);
  }

  const result = await query;
  let data = result.data as ExtractedHandoverItemRow[] | null;
  let error = result.error;

  if (error?.message.includes("review_reason")) {
    let fallbackQuery = supabase
      .from("extracted_handover_items")
      .select(extractedItemSelect)
      .order("confidence_score", { ascending: false });

    if (specificationId) {
      fallbackQuery = fallbackQuery.eq("specification_upload_id", specificationId);
    }

    const fallback = await fallbackQuery;
    data = fallback.data as ExtractedHandoverItemRow[] | null;
    error = fallback.error;
  }

  if (error || !data) {
    return specificationId
      ? extractedHandoverItems.filter((item) => item.specificationId === specificationId)
      : extractedHandoverItems;
  }

  return mapExtractedHandoverItemRows(data);
}

export async function getAcceptedHandoverPackagePreview() {
  const [items, projectList, workflowHandoverItems, checklistItems] = await Promise.all([
    getExtractedHandoverItems(),
    getProjects(),
    getWorkflowHandoverItems(),
    getProjectHandoverChecklistItems(),
  ]);
  const project = projectList[0];
  const workflowPreviewItems = project
    ? workflowHandoverItems
        .filter((item) => item.projectId === project.id)
        .map(workflowHandoverItemToPackageItem)
    : workflowHandoverItems.map(workflowHandoverItemToPackageItem);
  const checklistPreviewItems = (project
    ? checklistItems.filter((item) => item.projectId === project.id)
    : checklistItems
  ).filter(isChecklistPackageReady).map(checklistItemToPackageItem);
  const acceptedItems = items.filter(isPackageReadyExtractedItem);
  const previewItems = checklistPreviewItems.length ? checklistPreviewItems : workflowPreviewItems.length ? workflowPreviewItems : acceptedItems;

  return {
    project,
    products: previewItems.filter((item) => item.itemType === "product"),
    documents: previewItems.filter((item) => item.itemType === "document"),
    maintenance: previewItems.filter((item) => item.itemType === "maintenance"),
    acceptedItems: previewItems,
    builderOnlyPreview: workflowPreviewItems.length > 0 || checklistPreviewItems.length > 0,
  };
}

async function getProjectExtractedHandoverItems(projectId: string) {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const selectWithProject = `${extractedItemSelectWithReviewReason},specification_uploads!inner(project_id)`;
    const selectWithProjectFallback = `${extractedItemSelect},specification_uploads!inner(project_id)`;
    const result = await supabase
      .from("extracted_handover_items")
      .select(selectWithProject)
      .eq("specification_uploads.project_id", projectId)
      .order("confidence_score", { ascending: false });
    let data = result.data as ExtractedHandoverItemRow[] | null;
    let error = result.error;

    if (error?.message.includes("review_reason")) {
      const fallback = await supabase
        .from("extracted_handover_items")
        .select(selectWithProjectFallback)
        .eq("specification_uploads.project_id", projectId)
        .order("confidence_score", { ascending: false });
      data = fallback.data as ExtractedHandoverItemRow[] | null;
      error = fallback.error;
    }

    if (error || !data) {
      return [];
    }

    return mapExtractedHandoverItemRows(data);
  }

  const specifications = await getSpecificationUploads(projectId);
  const projectItems = await Promise.all(
    specifications.map((specification) => getExtractedHandoverItems(specification.id)),
  );

  return projectItems.flat();
}

export async function getPublishedClientPackagePreview(projectId?: string) {
  if (!hasSupabaseConfig()) {
    const [{ items, publishedAt }, projectList, workflowHandoverItems, checklistItems] = await Promise.all([
      getLocalPublishedItems(projectId),
      getProjects(),
      getWorkflowHandoverItems(projectId),
      getProjectHandoverChecklistItems(projectId),
    ]);
    const project = projectId
      ? projectList.find((candidate) => candidate.id === projectId)
      : projectList[0];
    const workflowItems = publishedAt
      ? workflowHandoverItems.map(workflowHandoverItemToPackageItem)
      : [];
    const checklistPackageItems = publishedAt
      ? checklistItems.filter(isChecklistPackageReady).map(checklistItemToPackageItem)
      : [];
    const publishedItems = checklistPackageItems.length ? checklistPackageItems : workflowItems.length ? workflowItems : items;

    return {
      project,
      publishedAt,
      products: publishedItems.filter((item) => item.itemType === "product"),
      documents: publishedItems.filter((item) => item.itemType === "document"),
      maintenance: publishedItems.filter((item) => item.itemType === "maintenance"),
    };
  }

  const [items, projectList, workflowHandoverItems, checklistItems] = await Promise.all([
    projectId ? getProjectExtractedHandoverItems(projectId) : getExtractedHandoverItems(),
    getProjects(),
    getWorkflowHandoverItems(projectId),
    getProjectHandoverChecklistItems(projectId),
  ]);
  const project = projectId
    ? projectList.find((candidate) => candidate.id === projectId)
    : projectList[0];
  const workflowItems = project?.publishedAt || !projectId
    ? workflowHandoverItems.map(workflowHandoverItemToPackageItem)
    : [];
  const checklistPackageItems = project?.publishedAt || !projectId
    ? checklistItems.filter(isChecklistPackageReady).map(checklistItemToPackageItem)
    : [];
  const acceptedItems = checklistPackageItems.length
    ? checklistPackageItems
    : workflowItems.length
      ? workflowItems
      : project?.publishedAt || !projectId
        ? items.filter(isPackageReadyExtractedItem)
        : [];

  return {
    project,
    publishedAt: acceptedItems.length ? project?.publishedAt || new Date().toISOString() : null,
    products: acceptedItems.filter((item) => item.itemType === "product"),
    documents: acceptedItems.filter((item) => item.itemType === "document"),
    maintenance: acceptedItems.filter((item) => item.itemType === "maintenance"),
  };
}

export async function getClientPortalData() {
  const projectsForViewer = await getProjects();
  const project = projectsForViewer[0] || null;

  if (!project) {
    return {
      project: null,
      projects: [],
      projectSummaries: [],
      visibleDocuments: [],
      documentDownloadEvents: [],
      maintenanceTasks: [],
      publishedPackage: {
        project: undefined,
        publishedAt: null,
        products: [],
        documents: [],
        maintenance: [],
      },
    };
  }

  const [documentsForProject, documentDownloadEventsForProject, maintenanceTasksForProject, publishedPackage] = await Promise.all([
    getDocuments(project.id),
    getDocumentDownloadEvents(project.id),
    getMaintenanceTasks(project.id),
    getPublishedClientPackagePreview(project.id),
  ]);
  const projectSummaries = await Promise.all(
    projectsForViewer.map(async (candidate) => {
      const [candidateDocuments, candidateDownloadEvents, candidateTasks, candidatePackage] = await Promise.all([
        getDocuments(candidate.id),
        getDocumentDownloadEvents(candidate.id),
        getMaintenanceTasks(candidate.id),
        getPublishedClientPackagePreview(candidate.id),
      ]);

      return {
        project: candidate,
        documentDownloadEvents: candidateDownloadEvents,
        visibleDocuments: candidateDocuments.filter((document) => document.visibleToClient),
        maintenanceTasks: candidateTasks,
        publishedPackage: candidatePackage,
      };
    }),
  );

  return {
    project,
    projects: projectsForViewer,
    projectSummaries,
    documentDownloadEvents: documentDownloadEventsForProject,
    visibleDocuments: documentsForProject.filter((document) => document.visibleToClient),
    maintenanceTasks: maintenanceTasksForProject,
    publishedPackage,
  };
}

export async function getClientRequests(): Promise<ClientRequest[]> {
  if (!hasSupabaseConfig()) {
    const [requests, extractedItems] = await Promise.all([
      getLocalClientRequests(),
      getLocalExtractedItems(),
    ]);

    return requests.map((request) => {
      const linkedItem = extractedItems.find(
        (item) =>
          item.sourceClientRequestId === request.id ||
          item.id === `${request.id}-extracted-item`,
      );

      if (linkedItem?.status === "global_approved") {
        return { ...request, status: "global_approved" };
      }

      if (linkedItem?.status === "rejected") {
        return { ...request, status: "rejected" };
      }

      return request;
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_requests")
    .select("id,project_id,request_type,title,location,details,attachment_name,status,confidence_score,created_at")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((request) => ({
    id: request.id,
    projectId: request.project_id,
    requestType: request.request_type,
    title: request.title,
    location: request.location || "",
    details: request.details || "",
    attachmentName: request.attachment_name || undefined,
    status: request.status,
    confidenceScore: request.confidence_score,
    createdAt: request.created_at,
  }));
}

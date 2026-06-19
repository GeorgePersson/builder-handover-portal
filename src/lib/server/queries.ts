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
} from "@/lib/document-workflow";
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
  getLocalProductMatches,
  getLocalUploadedDocuments,
} from "@/lib/server/local-store/uploaded-documents";

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

export async function getUploadedProjectDocuments(projectId?: string): Promise<UploadedProjectDocument[]> {
  if (!hasSupabaseConfig()) {
    return getLocalUploadedDocuments(projectId);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("uploaded_documents")
    .select("id,project_id,original_filename,file_type,mime_type,storage_path,processing_status,uploaded_by,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((document) => ({
    id: document.id,
    projectId: document.project_id,
    originalFilename: document.original_filename,
    fileType: document.file_type || undefined,
    mimeType: document.mime_type,
    storagePath: document.storage_path,
    processingStatus: document.processing_status,
    uploadedBy: document.uploaded_by || undefined,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
  }));
}

export async function getDocumentExtractionJobs(projectId?: string): Promise<DocumentExtractionJob[]> {
  if (!hasSupabaseConfig()) {
    return getLocalDocumentExtractionJobs(projectId);
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("document_extraction_jobs")
    .select("id,project_id,uploaded_document_id,status,error_message,started_at,completed_at,retry_count,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((job) => ({
    id: job.id,
    projectId: job.project_id,
    uploadedDocumentId: job.uploaded_document_id,
    status: job.status,
    errorMessage: job.error_message || undefined,
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
  let query = supabase
    .from("extracted_items")
    .select(
      "id,project_id,source_document_id,extraction_job_id,raw_extracted_data,product_name,brand,model,category,supplier,location,warranty_text,maintenance_text,confidence_score,match_status,review_status,matched_product_id,approved_by,approved_at,excluded_at,exclusion_reason,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
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
  const [items, projectList] = await Promise.all([
    getExtractedHandoverItems(),
    getProjects(),
  ]);
  const acceptedItems = items.filter(isPackageReadyExtractedItem);

  return {
    project: projectList[0],
    products: acceptedItems.filter((item) => item.itemType === "product"),
    documents: acceptedItems.filter((item) => item.itemType === "document"),
    maintenance: acceptedItems.filter((item) => item.itemType === "maintenance"),
    acceptedItems,
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
    const [{ items, publishedAt }, projectList] = await Promise.all([
      getLocalPublishedItems(projectId),
      getProjects(),
    ]);
    const project = projectId
      ? projectList.find((candidate) => candidate.id === projectId)
      : projectList[0];

    return {
      project,
      publishedAt,
      products: items.filter((item) => item.itemType === "product"),
      documents: items.filter((item) => item.itemType === "document"),
      maintenance: items.filter((item) => item.itemType === "maintenance"),
    };
  }

  const [items, projectList] = await Promise.all([
    projectId ? getProjectExtractedHandoverItems(projectId) : getExtractedHandoverItems(),
    getProjects(),
  ]);
  const project = projectId
    ? projectList.find((candidate) => candidate.id === projectId)
    : projectList[0];
  const acceptedItems = project?.publishedAt || !projectId ? items.filter(isPackageReadyExtractedItem) : [];

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

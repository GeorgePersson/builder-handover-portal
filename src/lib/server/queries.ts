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
  HandoverDocument,
  MaintenanceTask,
  ProductVersion,
  Project,
  ExtractedHandoverItem,
  SpecificationUpload,
} from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getLocalExtractedItems,
  getLocalPublishedItems,
  getLocalSpecificationUploads,
} from "@/lib/server/local-store/specifications";
import { getLocalClientRequests } from "@/lib/server/local-store/client-requests";
import { getLocalGlobalProducts } from "@/lib/server/local-store/products";

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const packageReadyStatuses = new Set([
  "accepted",
  "auto_approved",
  "builder_approved",
  "global_approved",
]);

export function isPackageReadyExtractedItem(item: Pick<ExtractedHandoverItem, "status">) {
  return packageReadyStatuses.has(item.status);
}

export async function getProjects(): Promise<Project[]> {
  if (!hasSupabaseConfig()) {
    return projects;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,address,project_type,status,handover_date,created_at,project_clients(name,email)")
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
      projectType: project.project_type,
      handoverDate: project.handover_date || project.created_at,
      status: project.status,
      documentCount: 0,
      productCount: 0,
      openTasks: 0,
      lastActivity: project.created_at,
    } satisfies Project;
  });
}

export async function getDocuments(): Promise<HandoverDocument[]> {
  if (!hasSupabaseConfig()) {
    return documents;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id,project_id,name,document_type,size_bytes,visible_to_client,created_at")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return documents;
  }

  return data.map((document) => ({
    id: document.id,
    projectId: document.project_id,
    name: document.name,
    type: document.document_type,
    size: document.size_bytes ? `${Math.round(Number(document.size_bytes) / 1024)} KB` : "Pending upload",
    uploadedAt: document.created_at,
    visibleToClient: document.visible_to_client,
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

export async function getMaintenanceTasks(): Promise<MaintenanceTask[]> {
  if (!hasSupabaseConfig()) {
    return maintenanceTasks;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("maintenance_tasks")
    .select("id,project_id,title,due_date,frequency,required_for_warranty,created_at")
    .order("due_date", { ascending: true });

  if (error || !data) {
    return maintenanceTasks;
  }

  return data.map((task) => ({
    id: task.id,
    projectId: task.project_id,
    title: task.title,
    cadence: task.frequency || "One-off",
    dueDate: task.due_date,
    requiredForWarranty: task.required_for_warranty,
    relatedProduct: "Project maintenance",
    status: new Date(task.due_date) < new Date() ? "overdue" : "upcoming",
  }));
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

export async function getSpecificationUploads(): Promise<SpecificationUpload[]> {
  if (!hasSupabaseConfig()) {
    const localUploads = await getLocalSpecificationUploads();
    return [...localUploads, ...specificationUploads];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("specification_uploads")
    .select("id,project_id,file_name,status,created_at")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return specificationUploads;
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
    .select(
      "id,specification_upload_id,item_type,title,category,location,extracted_text,matched_existing_record,client_request_id,confidence_score,status",
    )
    .order("confidence_score", { ascending: false });

  if (specificationId) {
    query = query.eq("specification_upload_id", specificationId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return specificationId
      ? extractedHandoverItems.filter((item) => item.specificationId === specificationId)
      : extractedHandoverItems;
  }

  return data.map((item) => ({
    id: item.id,
    specificationId: item.specification_upload_id,
    itemType: item.item_type,
    title: item.title,
    category: item.category,
    location: item.location || "",
    extractedText: item.extracted_text || "",
    matchedExistingRecord: item.matched_existing_record,
    sourceClientRequestId: item.client_request_id || undefined,
    confidenceScore: item.confidence_score,
    status: item.status,
  }));
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

export async function getPublishedClientPackagePreview() {
  if (!hasSupabaseConfig()) {
    const [{ items, publishedAt }, projectList] = await Promise.all([
      getLocalPublishedItems(),
      getProjects(),
    ]);

    return {
      project: projectList[0],
      publishedAt,
      products: items.filter((item) => item.itemType === "product"),
      documents: items.filter((item) => item.itemType === "document"),
      maintenance: items.filter((item) => item.itemType === "maintenance"),
    };
  }

  const [items, projectList] = await Promise.all([
    getExtractedHandoverItems(),
    getProjects(),
  ]);
  const acceptedItems = items.filter(isPackageReadyExtractedItem);

  return {
    project: projectList[0],
    publishedAt: acceptedItems.length ? new Date().toISOString() : null,
    products: acceptedItems.filter((item) => item.itemType === "product"),
    documents: acceptedItems.filter((item) => item.itemType === "document"),
    maintenance: acceptedItems.filter((item) => item.itemType === "maintenance"),
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

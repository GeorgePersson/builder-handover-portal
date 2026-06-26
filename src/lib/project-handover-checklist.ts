export const handoverChecklistItemStatuses = [
  "complete",
  "needs_review",
  "missing_manual",
  "missing_care_instructions",
  "missing_warranty_information",
  "missing_invoice_information",
  "missing_code_compliance_information",
  "not_enough_information_to_search",
  "documents_uploaded_manually",
  "user_accepted_incomplete",
] as const;

export const handoverChecklistSectionStatuses = [
  "not_required",
  "missing",
  "provided",
  "uploaded_manually",
  "autofilled_needs_review",
  "reviewed",
  "accepted_incomplete",
] as const;

export const handoverChecklistValueSources = [
  "manual_entry",
  "manual_upload",
  "database_autofill",
  "source_search",
  "extracted_document",
  "general_guidance",
] as const;

export const handoverChecklistEventTypes = [
  "created",
  "updated",
  "database_autofilled",
  "source_search_attempted",
  "manual_document_uploaded",
  "marked_complete",
  "accepted_incomplete",
] as const;

export type HandoverChecklistItemStatus = (typeof handoverChecklistItemStatuses)[number];
export type HandoverChecklistSectionStatus = (typeof handoverChecklistSectionStatuses)[number];
export type HandoverChecklistValueSource = (typeof handoverChecklistValueSources)[number];
export type HandoverChecklistEventType = (typeof handoverChecklistEventTypes)[number];

export type HandoverChecklistSectionStatuses = {
  careInstructions: HandoverChecklistSectionStatus;
  manual: HandoverChecklistSectionStatus;
  warranty: HandoverChecklistSectionStatus;
  invoice: HandoverChecklistSectionStatus;
  codeCompliance: HandoverChecklistSectionStatus;
  supportingDocuments: HandoverChecklistSectionStatus;
};

export type ProjectHandoverChecklistItem = {
  id: string;
  projectId: string;
  sourceExtractedItemId?: string;
  sourceDocumentId?: string;
  extractionJobId?: string;
  title: string;
  category?: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
  sku?: string;
  productCode?: string;
  supplier?: string;
  supplierSku?: string;
  careInstructions?: string;
  manualDocumentId?: string;
  manualUrl?: string;
  warrantyInformation?: string;
  warrantyDocumentId?: string;
  warrantyGuidanceIsGeneral?: boolean;
  invoiceDocumentId?: string;
  invoiceData?: string;
  codeComplianceDocumentId?: string;
  codeComplianceInformation?: string;
  supportingDocumentIds: string[];
  extraNotes?: string;
  sectionStatuses: HandoverChecklistSectionStatuses;
  valueSources: HandoverChecklistValueSource[];
  sourceMetadata: Record<string, unknown>;
  status: HandoverChecklistItemStatus;
  completionSummary?: string;
  acceptedIncompleteReason?: string;
  acceptedIncompleteAt?: string;
  acceptedIncompleteBy?: string;
  createdBy?: string;
  lastEditedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectHandoverChecklistEvent = {
  id: string;
  projectId: string;
  checklistItemId: string;
  eventType: HandoverChecklistEventType;
  actorId?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ProjectHandoverChecklistItemInput = Pick<ProjectHandoverChecklistItem, "projectId" | "title"> &
  Partial<Omit<ProjectHandoverChecklistItem, "id" | "projectId" | "title" | "status" | "sectionStatuses" | "supportingDocumentIds" | "valueSources" | "sourceMetadata" | "createdAt" | "updatedAt">> & {
    sectionStatuses?: Partial<HandoverChecklistSectionStatuses>;
    supportingDocumentIds?: string[];
    valueSources?: HandoverChecklistValueSource[];
    sourceMetadata?: Record<string, unknown>;
  };

export const defaultChecklistSectionStatuses: HandoverChecklistSectionStatuses = {
  careInstructions: "missing",
  manual: "missing",
  warranty: "missing",
  invoice: "not_required",
  codeCompliance: "not_required",
  supportingDocuments: "missing",
};

const vagueItemTitles = new Set([
  "appliance",
  "appliances",
  "carpet",
  "door",
  "doors",
  "oven",
  "paint",
  "tap",
  "taps",
  "tapware",
  "tile",
  "tiles",
  "toilet",
  "vanity",
]);

function clean(value?: string | null) {
  return value?.trim() || "";
}

function sectionProvided(status?: HandoverChecklistSectionStatus) {
  return status === "provided" || status === "uploaded_manually" || status === "reviewed" || status === "not_required";
}

export function hasEnoughIdentityToSearch(item: Partial<ProjectHandoverChecklistItem>) {
  const title = clean(item.title);
  const normalizedTitle = title.toLowerCase();
  const brandOrManufacturer = clean(item.brand) || clean(item.manufacturer);
  const modelOrCode = clean(item.model) || clean(item.sku) || clean(item.productCode);
  const supplierIdentity = clean(item.supplier) && (clean(item.supplierSku) || clean(item.productCode));
  const specificTitle = title.length >= 8 && !vagueItemTitles.has(normalizedTitle);
  const distinguishingDetail = clean(item.category) || clean(item.extraNotes) || clean(item.supplier) || clean(item.manualUrl);
  const documentEvidence = (item.supportingDocumentIds || []).length > 0 || clean(item.invoiceDocumentId) || clean(item.manualDocumentId);

  return Boolean(
    (brandOrManufacturer && modelOrCode) ||
    supplierIdentity ||
    (brandOrManufacturer && specificTitle) ||
    (specificTitle && distinguishingDetail && documentEvidence)
  );
}

export function getMissingChecklistSections(item: Pick<ProjectHandoverChecklistItem, "sectionStatuses">) {
  const labels: Record<keyof HandoverChecklistSectionStatuses, string> = {
    careInstructions: "care instructions",
    manual: "manual",
    warranty: "warranty information",
    invoice: "invoice information",
    codeCompliance: "Code of Compliance information",
    supportingDocuments: "supporting documents",
  };

  return (Object.entries(item.sectionStatuses) as Array<[keyof HandoverChecklistSectionStatuses, HandoverChecklistSectionStatus]>)
    .filter(([, status]) => status === "missing" || status === "autofilled_needs_review")
    .map(([key]) => labels[key]);
}

export function deriveProjectHandoverChecklistStatus(
  item: Pick<ProjectHandoverChecklistItem,
    | "acceptedIncompleteAt"
    | "careInstructions"
    | "manualDocumentId"
    | "manualUrl"
    | "warrantyInformation"
    | "warrantyDocumentId"
    | "invoiceData"
    | "invoiceDocumentId"
    | "codeComplianceInformation"
    | "codeComplianceDocumentId"
    | "sectionStatuses"
    | "supportingDocumentIds"
  > & Partial<ProjectHandoverChecklistItem>,
): HandoverChecklistItemStatus {
  if (item.acceptedIncompleteAt) {
    return "user_accepted_incomplete";
  }

  if (!hasEnoughIdentityToSearch(item) && getMissingChecklistSections({ sectionStatuses: item.sectionStatuses }).length > 0) {
    return "not_enough_information_to_search";
  }

  if (!sectionProvided(item.sectionStatuses.manual) && !clean(item.manualDocumentId) && !clean(item.manualUrl)) {
    return "missing_manual";
  }

  if (!sectionProvided(item.sectionStatuses.careInstructions) && !clean(item.careInstructions)) {
    return "missing_care_instructions";
  }

  if (!sectionProvided(item.sectionStatuses.warranty) && !clean(item.warrantyInformation) && !clean(item.warrantyDocumentId)) {
    return "missing_warranty_information";
  }

  if (item.sectionStatuses.invoice === "missing" && !clean(item.invoiceData) && !clean(item.invoiceDocumentId)) {
    return "missing_invoice_information";
  }

  if (item.sectionStatuses.codeCompliance === "missing" && !clean(item.codeComplianceInformation) && !clean(item.codeComplianceDocumentId)) {
    return "missing_code_compliance_information";
  }

  if (!sectionProvided(item.sectionStatuses.supportingDocuments) && (item.supportingDocumentIds || []).length > 0) {
    return "documents_uploaded_manually";
  }

  const allRequiredSatisfied = Object.values(item.sectionStatuses).every(sectionProvided);
  return allRequiredSatisfied ? "complete" : "needs_review";
}

export function buildProjectHandoverChecklistItem(
  input: ProjectHandoverChecklistItemInput,
  options: { id: string; actorId?: string; timestamp?: string },
): ProjectHandoverChecklistItem {
  const timestamp = options.timestamp || new Date().toISOString();
  const sectionStatuses = {
    ...defaultChecklistSectionStatuses,
    ...(input.sectionStatuses || {}),
  };
  const draft: ProjectHandoverChecklistItem = {
    id: options.id,
    projectId: input.projectId,
    sourceExtractedItemId: input.sourceExtractedItemId,
    sourceDocumentId: input.sourceDocumentId,
    extractionJobId: input.extractionJobId,
    title: input.title,
    category: input.category,
    brand: input.brand,
    manufacturer: input.manufacturer,
    model: input.model,
    sku: input.sku,
    productCode: input.productCode,
    supplier: input.supplier,
    supplierSku: input.supplierSku,
    careInstructions: input.careInstructions,
    manualDocumentId: input.manualDocumentId,
    manualUrl: input.manualUrl,
    warrantyInformation: input.warrantyInformation,
    warrantyDocumentId: input.warrantyDocumentId,
    warrantyGuidanceIsGeneral: input.warrantyGuidanceIsGeneral,
    invoiceDocumentId: input.invoiceDocumentId,
    invoiceData: input.invoiceData,
    codeComplianceDocumentId: input.codeComplianceDocumentId,
    codeComplianceInformation: input.codeComplianceInformation,
    supportingDocumentIds: input.supportingDocumentIds || [],
    extraNotes: input.extraNotes,
    sectionStatuses,
    valueSources: input.valueSources || ["manual_entry"],
    sourceMetadata: input.sourceMetadata || {},
    status: "needs_review",
    completionSummary: input.completionSummary,
    acceptedIncompleteReason: input.acceptedIncompleteReason,
    acceptedIncompleteAt: input.acceptedIncompleteAt,
    acceptedIncompleteBy: input.acceptedIncompleteBy,
    createdBy: input.createdBy || options.actorId,
    lastEditedBy: input.lastEditedBy || options.actorId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    ...draft,
    status: deriveProjectHandoverChecklistStatus(draft),
  };
}

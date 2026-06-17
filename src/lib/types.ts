export type Role = "owner" | "builder_admin" | "client";

export type ProjectStatus = "draft" | "in_review" | "published";

export type ConfidenceLabel = "high" | "medium" | "low" | "blocked";

export type ProductStatus = "approved" | "needs_review" | "draft" | "blocked";

export type DocumentType =
  | "consent"
  | "manual"
  | "warranty"
  | "producer_statement"
  | "photo"
  | "other";

export type Project = {
  id: string;
  name: string;
  address: string;
  clientName: string;
  clientEmail: string;
  projectType: string;
  handoverDate: string;
  status: ProjectStatus;
  documentCount: number;
  productCount: number;
  openTasks: number;
  lastActivity: string;
};

export type HandoverDocument = {
  id: string;
  projectId: string;
  name: string;
  type: DocumentType;
  size: string;
  uploadedAt: string;
  visibleToClient: boolean;
};

export type Source = {
  title: string;
  url: string;
  sourceType: "manufacturer_page" | "warranty_pdf" | "care_guide" | "supplier_page";
  official: boolean;
  nzSpecific: boolean;
};

export type ProductVersion = {
  id: string;
  productName: string;
  brand: string;
  category: string;
  location: string;
  warrantyPeriod: string;
  maintenanceSummary: string;
  voidConditions: string;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  status: ProductStatus;
  checkedAt: string;
  sources: Source[];
  missingFields: string[];
  reviewReason: string;
};

export type MaintenanceTask = {
  id: string;
  projectId: string;
  title: string;
  cadence: string;
  dueDate: string;
  requiredForWarranty: boolean;
  relatedProduct: string;
  status: "upcoming" | "overdue" | "complete";
};

export type SpecificationUpload = {
  id: string;
  projectId: string;
  fileName: string;
  uploadedAt: string;
  status: "uploaded" | "extracting" | "needs_review" | "accepted";
  extractedCount: number;
  newItemCount: number;
  matchedItemCount: number;
};

export type ExtractedHandoverItem = {
  id: string;
  specificationId: string;
  itemType: "product" | "document" | "maintenance";
  title: string;
  category: string;
  location: string;
  extractedText: string;
  matchedExistingRecord: string | null;
  sourceClientRequestId?: string;
  confidenceScore: number;
  status:
    | "proposed"
    | "auto_approved"
    | "builder_approved"
    | "admin_review"
    | "global_approved"
    | "accepted"
    | "edited"
    | "rejected";
};

export type AuditEvent = {
  id: string;
  projectId?: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type ClientRequest = {
  id: string;
  projectId: string;
  requestType: "product" | "document" | "maintenance";
  title: string;
  location: string;
  details: string;
  attachmentName?: string;
  status: "submitted" | "ai_checking" | "admin_review" | "builder_project_approved" | "global_approved" | "rejected";
  confidenceScore: number;
  createdAt: string;
};

import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import type { ExtractedWorkflowItem } from "@/lib/document-workflow";
import {
  getStrongestIdentity,
  type OutlineSpecExtractedItem,
  type OutlineSpecExtraction,
} from "@/lib/extraction/outline-spec-schema";

function clampConfidence(value: unknown) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 35;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function compact(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getItemType(item: OutlineSpecExtractedItem): ProposedSpecItem["item_type"] {
  const classification = item.Review?.ContextClassification;
  const category = item.ItemName.Category?.toLowerCase() || "";
  const name = item.ItemName.Name?.toLowerCase() || "";

  if (classification === "project_document") {
    return "document";
  }

  if (
    category.includes("maintenance") ||
    name.includes("maintenance") ||
    name.includes("clean") ||
    name.includes("service")
  ) {
    return "maintenance";
  }

  return "product";
}

const adminOrContractPatterns = [
  /\b(consent|council|inspection|code\s+compliance|ccc|producer\s+statement|ps[1-4])\b/i,
  /\b(contract|payment|claim|variation|preliminar(?:y|ies)|insurance|health\s+and\s+safety)\b/i,
  /\b(site\s+(?:setup|access|security|fencing|clean|clearance|management|services?))\b/i,
  /\b(scaffold|temporary\s+works|skip\s+bin|rubbish|waste\s+management|portaloo)\b/i,
  /\b(excavat(?:e|ion)|earthworks|setout|survey|drainage\s+connection|service\s+trench)\b/i,
  /\b(builder'?s?\s+work|workmanship|install(?:ation)?\s+by|allow(?:ance|ances)|provisional\s+sum)\b/i,
];

const handoverSpecificPatterns = [
  /\b(warranty|manual|certificate|producer\s+statement|maintenance|care|cleaning)\b/i,
  /\b(appliance|fixture|fitting|tap|mixer|sink|vanity|toilet|bath|shower|tile|carpet|flooring)\b/i,
  /\b(door|window|hardware|paint|cladding|roof|spouting|gutter|heat\s+pump|ventilation)\b/i,
  /\b(brand|model|sku|product\s+code|colour|finish|supplier|manufacturer)\b/i,
];

function getCombinedItemText(item: OutlineSpecExtractedItem) {
  return [
    item.ItemName.Name,
    item.ItemName.Category,
    item.ItemName.Description,
    item.ItemName.Notes,
    item.Evidence?.SourceSection,
    item.Evidence?.SourceSnippet,
  ]
    .filter(Boolean)
    .join(" ");
}

function looksLikeAdminOrContractNoise(item: OutlineSpecExtractedItem) {
  const classification = item.Review?.ContextClassification;

  if (classification === "admin_or_contract" || classification === "not_handover_relevant") {
    return true;
  }

  if (
    classification === "known_match_candidate" ||
    classification === "source_ready_unknown" ||
    classification === "project_document"
  ) {
    return false;
  }

  const hasIdentityEvidence = Boolean(getStrongestIdentity(item.ItemName));
  const text = getCombinedItemText(item);

  if (hasIdentityEvidence || handoverSpecificPatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  return adminOrContractPatterns.some((pattern) => pattern.test(text));
}

function getRecommendedAction(item: OutlineSpecExtractedItem): ProposedSpecItem["recommended_action"] {
  const classification = item.Review?.ContextClassification;

  if (looksLikeAdminOrContractNoise(item)) {
    return "manual_review";
  }

  if (classification === "project_document") {
    return "request_document";
  }

  if (
    classification === "builder_input_needed" ||
    classification === "generic_allowance" ||
    classification === "admin_or_contract" ||
    classification === "not_handover_relevant"
  ) {
    return "manual_review";
  }

  return item.ItemName.HasIdentifier ? "review_new_product" : "manual_review";
}

function getTitle(item: OutlineSpecExtractedItem) {
  return compact([
    item.ItemName.Manufacturer,
    item.ItemName.ProductRange,
    item.ItemName.ModelName,
    item.ItemName.ProductCode,
    item.ItemName.Name,
  ]) || "Unclassified specification item";
}

function getExtractedText(item: OutlineSpecExtractedItem) {
  return [
    item.Evidence?.SourceSnippet,
    item.ItemName.Description,
    item.ItemName.Notes,
    getStrongestIdentity(item.ItemName) ? `Identity: ${getStrongestIdentity(item.ItemName)}` : "",
    item.Review?.MissingFields?.length ? `Missing: ${item.Review.MissingFields.join(", ")}` : "",
    item.Review?.BuilderQuestions?.length ? `Builder questions: ${item.Review.BuilderQuestions.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeOutlineSpecExtraction(extraction: OutlineSpecExtraction): ProposedSpecItem[] {
  return extraction.Items.map((item) => ({
    item_type: getItemType(item),
    title: getTitle(item),
    category: item.ItemName.Category || "To review",
    location: item.ItemName.Location || "Project",
    extracted_text: getExtractedText(item),
    matched_existing_record: null,
    confidence_score: clampConfidence(item.Evidence?.Confidence),
    recommended_action: getRecommendedAction(item),
  }));
}

function getCareGuidanceSourceLabel(sourceType: ExtractedWorkflowItem["careGuidanceSourceType"]) {
  const labels = {
    manufacturer: "Manufacturer guidance",
    supplier: "Supplier guidance",
    builder_supplied: "Builder supplied guidance",
    general_ai: "General AI care guidance - builder review required",
    unknown: "Care source not confirmed",
  };

  return labels[sourceType || "unknown"];
}

function getQuoteReferenceText(item: OutlineSpecExtractedItem) {
  const text = [
    item.ItemName.Name,
    item.ItemName.Supplier,
    item.ItemName.Description,
    item.ItemName.Notes,
    item.Evidence?.SourceSnippet,
    item.Review?.SourceGapReason,
  ]
    .filter(Boolean)
    .join(" ");

  return /\b(as\s+per|per|refer|see|by)\b.*\b(quote|invoice|schedule|selection|supplier)\b/i.test(text) ||
    /\b(quote|invoice|supplier\s+schedule|selection\s+schedule|tbc\s+by\s+supplier)\b/i.test(text)
    ? compact([item.ItemName.Notes, item.Evidence?.SourceSnippet, item.ItemName.Supplier])
    : undefined;
}

function getInitialReviewStatus(item: OutlineSpecExtractedItem): ExtractedWorkflowItem["reviewStatus"] {
  const classification = item.Review?.ContextClassification;
  const confidence = clampConfidence(item.Evidence?.Confidence);

  if (looksLikeAdminOrContractNoise(item)) {
    return "low_confidence";
  }

  if (
    classification === "builder_input_needed" ||
    classification === "generic_allowance" ||
    classification === "project_document"
  ) {
    return "needs_review";
  }

  if (classification === "admin_or_contract" || classification === "not_handover_relevant") {
    return "low_confidence";
  }

  return confidence >= 55 ? "unmatched" : "low_confidence";
}

export function normalizeOutlineSpecExtractionToWorkflowItems(input: {
  extraction: OutlineSpecExtraction;
  projectId: string;
  sourceDocumentId: string;
  extractionJobId: string;
  sourceFilename: string;
  sourceMimeType: string;
  parentExtractedItemId?: string;
  sourceQuoteDocumentId?: string;
}): Array<Omit<ExtractedWorkflowItem, "id" | "createdAt" | "updatedAt">> {
  return input.extraction.Items.map((item) => {
    const itemType = getItemType(item);
    const title = getTitle(item);
    const aiSuggestedCategory = item.ItemName.Category || "To review";
    const builderApprovedCategory = aiSuggestedCategory;
    const confidenceScore = clampConfidence(item.Evidence?.Confidence);
    const quoteReferenceText = getQuoteReferenceText(item);
    const careGuidanceSourceType: ExtractedWorkflowItem["careGuidanceSourceType"] =
      item.ItemName.Notes?.toLowerCase().includes("general guidance")
        ? "general_ai"
        : item.ItemName.Supplier
          ? "supplier"
          : item.ItemName.Manufacturer
            ? "manufacturer"
            : "unknown";
    const originalExtractedValues = {
      schema: "outline_spec_v1",
      itemType,
      productName: title,
      manufacturer: item.ItemName.Manufacturer || undefined,
      brand: item.ItemName.Manufacturer || undefined,
      model: item.ItemName.ModelName || item.ItemName.ProductCode || undefined,
      aiSuggestedCategory,
      builderApprovedCategory,
      supplierName: item.ItemName.Supplier || undefined,
      supplierSku: item.ItemName.Sku || undefined,
      location: item.ItemName.Location || undefined,
      quantity: item.ItemName.Quantity || undefined,
      variantOrFinish: compact([item.ItemName.Finish, item.ItemName.Colour, item.ItemName.Size]) || undefined,
      warrantyText: undefined,
      maintenanceText: undefined,
      sourcePage: item.Evidence?.SourcePage || undefined,
      sourceSection: item.Evidence?.SourceSection || undefined,
      sourceSnippet: item.Evidence?.SourceSnippet || undefined,
      contextClassification: item.Review?.ContextClassification || undefined,
      missingFields: item.Review?.MissingFields || [],
      builderQuestions: item.Review?.BuilderQuestions || [],
      quoteReferenceText,
    };
    const reviewStatus = getInitialReviewStatus(item);

    return {
      projectId: input.projectId,
      sourceDocumentId: input.sourceDocumentId,
      extractionJobId: input.extractionJobId,
      parentExtractedItemId: input.parentExtractedItemId,
      sourceQuoteDocumentId: input.sourceQuoteDocumentId,
      rawExtractedData: {
        extractorSchema: "outline_spec_v1",
        sourceFilename: input.sourceFilename,
        sourceMimeType: input.sourceMimeType,
        outlineSpecItem: item,
        outlineSpecDocument: {
          specificationNumber: input.extraction.SpecificationNumber,
          address: input.extraction.Address,
          date: input.extraction.Date,
        },
        contextSchema: {
          itemType,
          sourceEvidenceText: item.Evidence?.SourceSnippet || undefined,
          missingFields: item.Review?.MissingFields || [],
          builderInfoNeeded: item.Review?.BuilderQuestions || [],
          contextClassification: item.Review?.ContextClassification || "builder_input_needed",
          classificationReason: item.Review?.SourceGapReason || "Outline-spec schema extraction requires builder review.",
          isSearchReady: item.Review?.IsSearchReady || false,
        },
      },
      originalExtractedValues,
      builderEditedValues: {},
      itemType,
      productName: title,
      manufacturer: item.ItemName.Manufacturer || undefined,
      brand: item.ItemName.Manufacturer || undefined,
      model: item.ItemName.ModelName || item.ItemName.ProductCode || undefined,
      aiSuggestedCategory,
      builderApprovedCategory,
      category: builderApprovedCategory,
      supplierName: item.ItemName.Supplier || undefined,
      supplier: item.ItemName.Supplier || undefined,
      supplierSku: item.ItemName.Sku || undefined,
      location: item.ItemName.Location || undefined,
      quantity: item.ItemName.Quantity || undefined,
      variantOrFinish: compact([item.ItemName.Finish, item.ItemName.Colour, item.ItemName.Size]) || undefined,
      maintenanceText: item.ItemName.Notes || item.ItemName.Description || undefined,
      careGuidanceSourceType,
      careGuidanceSourceLabel: getCareGuidanceSourceLabel(careGuidanceSourceType),
      careGuidanceReviewRequired: careGuidanceSourceType === "general_ai",
      identityFingerprint: getStrongestIdentity(item.ItemName) || undefined,
      quoteReferenceText,
      quoteReferenceStatus: quoteReferenceText ? "referenced" : "not_applicable",
      sourcePage: item.Evidence?.SourcePage || undefined,
      sourceSection: item.Evidence?.SourceSection || undefined,
      sourceSnippet: item.Evidence?.SourceSnippet || undefined,
      confidenceScore,
      matchStatus: reviewStatus === "low_confidence" ? "low_confidence" : "unmatched",
      reviewStatus,
    };
  });
}

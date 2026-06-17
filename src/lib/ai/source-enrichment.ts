import type {
  ConfidenceLabel,
  ExtractedHandoverItem,
  ProductStatus,
  ProductVersion,
  Source,
} from "@/lib/types";

type SourceEnrichment = {
  brand: string;
  manufacturer: string | null;
  warrantyPeriod: string;
  maintenanceSummary: string;
  voidConditions: string;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  status: ProductStatus;
  sources: Source[];
  missingFields: string[];
  reviewReason: string;
};

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function labelForScore(score: number): ConfidenceLabel {
  if (score >= 85) {
    return "high";
  }

  if (score >= 55) {
    return "medium";
  }

  if (score >= 25) {
    return "low";
  }

  return "blocked";
}

export function enrichExtractedProduct(item: ExtractedHandoverItem): SourceEnrichment {
  const searchableText = [
    item.title,
    item.category,
    item.location,
    item.extractedText,
    item.matchedExistingRecord || "",
  ]
    .join(" ")
    .toLowerCase();

  if (hasAny(searchableText, ["linea", "james hardie", "weatherboard"])) {
    return {
      brand: "James Hardie",
      manufacturer: "James Hardie",
      warrantyPeriod: "15 years subject to installation and maintenance conditions",
      maintenanceSummary: "Wash exterior surfaces annually, more often in coastal zones.",
      voidConditions:
        "Incorrect installation, missed coating requirements, or poor maintenance may affect warranty cover.",
      confidenceScore: Math.max(item.confidenceScore, 94),
      confidenceLabel: "high",
      status: "approved",
      sources: [
        {
          title: "James Hardie NZ product information",
          url: "https://www.jameshardie.co.nz/",
          sourceType: "manufacturer_page",
          official: true,
          nzSpecific: true,
        },
        {
          title: "James Hardie NZ warranty guidance",
          url: "https://www.jameshardie.co.nz/",
          sourceType: "warranty_pdf",
          official: true,
          nzSpecific: true,
        },
      ],
      missingFields: [],
      reviewReason: "Known NZ cladding product matched with official manufacturer source metadata.",
    };
  }

  if (hasAny(searchableText, ["fisher", "paykel", "dishwasher"])) {
    return {
      brand: "Fisher & Paykel",
      manufacturer: "Fisher & Paykel",
      warrantyPeriod: "2 years, exact model confirmation needed",
      maintenanceSummary: "Clean filters regularly and follow the model-specific care guide.",
      voidConditions: "Misuse, unauthorised repairs, and non-domestic use may affect cover.",
      confidenceScore: Math.max(item.confidenceScore, 68),
      confidenceLabel: "medium",
      status: "needs_review",
      sources: [
        {
          title: "Fisher & Paykel NZ product support",
          url: "https://www.fisherpaykel.com/nz/",
          sourceType: "manufacturer_page",
          official: true,
          nzSpecific: true,
        },
      ],
      missingFields: ["Exact model number", "Model-specific warranty source", "Model-specific care guide"],
      reviewReason: "Manufacturer found, but the model-specific warranty and care source still needs review.",
    };
  }

  return {
    brand: "Admin approved",
    manufacturer: null,
    warrantyPeriod: "Admin approved; source details to be enriched",
    maintenanceSummary: item.extractedText || "Maintenance details to be enriched from official sources.",
    voidConditions: "To be confirmed from official source documents.",
    confidenceScore: item.confidenceScore,
    confidenceLabel: labelForScore(item.confidenceScore),
    status: "needs_review",
    sources: [],
    missingFields: ["Official source URLs", "Warranty terms", "Maintenance requirements"],
    reviewReason: "Approved by platform admin but still needs source enrichment before it is fully source-backed.",
  };
}

export function buildGlobalProductFromExtractedItem(item: ExtractedHandoverItem): ProductVersion {
  const enrichment = enrichExtractedProduct(item);

  return {
    id: `global-product-${item.id}`,
    productName: item.title,
    brand: enrichment.brand,
    category: item.category || "Product",
    location: item.location,
    warrantyPeriod: enrichment.warrantyPeriod,
    maintenanceSummary: enrichment.maintenanceSummary,
    voidConditions: enrichment.voidConditions,
    confidenceScore: enrichment.confidenceScore,
    confidenceLabel: enrichment.confidenceLabel,
    status: enrichment.status,
    checkedAt: new Date().toISOString(),
    sources: enrichment.sources,
    missingFields: enrichment.missingFields,
    reviewReason: enrichment.reviewReason,
  };
}

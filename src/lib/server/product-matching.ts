import type {
  ExtractedItemMatchStatus,
  ExtractedItemReviewStatus,
  ExtractedWorkflowItem,
} from "@/lib/document-workflow";

export type VerifiedProductCandidate = {
  productId: string;
  productName: string;
  brand?: string;
  manufacturer?: string;
  category?: string;
  confidenceScore?: number;
  status?: string;
};

export type ProductMatchResult = {
  extractedItemId: string;
  matchedProductId?: string;
  matchStatus: ExtractedItemMatchStatus;
  reviewStatus: ExtractedItemReviewStatus;
  matchConfidenceScore: number;
  matchReason: string;
};

function normalize(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 1));
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return Math.round((shared / Math.max(leftTokens.size, rightTokens.size)) * 100);
}

function isVerifiedCandidate(candidate: VerifiedProductCandidate) {
  return candidate.status === "approved" && (candidate.confidenceScore || 0) >= 70;
}

function classifyMatch(input: {
  item: ExtractedWorkflowItem;
  candidate?: VerifiedProductCandidate;
  score: number;
  reason: string;
}): ProductMatchResult {
  if (input.item.confidenceScore < 45) {
    return {
      extractedItemId: input.item.id,
      matchedProductId: input.candidate?.productId,
      matchStatus: "low_confidence",
      reviewStatus: "low_confidence",
      matchConfidenceScore: Math.min(input.score, input.item.confidenceScore),
      matchReason: `Extraction confidence is ${input.item.confidenceScore}; builder review required before matching.`,
    };
  }

  if (!input.candidate || input.score < 50) {
    return {
      extractedItemId: input.item.id,
      matchStatus: "unmatched",
      reviewStatus: "unmatched",
      matchConfidenceScore: 0,
      matchReason: "No approved local product database match found.",
    };
  }

  if (input.score >= 90 && isVerifiedCandidate(input.candidate)) {
    return {
      extractedItemId: input.item.id,
      matchedProductId: input.candidate.productId,
      matchStatus: "verified_match",
      reviewStatus: "verified_match",
      matchConfidenceScore: input.score,
      matchReason: input.reason,
    };
  }

  return {
    extractedItemId: input.item.id,
    matchedProductId: input.candidate.productId,
    matchStatus: "needs_review",
    reviewStatus: "needs_review",
    matchConfidenceScore: input.score,
    matchReason: `${input.reason} Builder review required before using this match.`,
  };
}

export function matchExtractedItemToVerifiedProduct(
  item: ExtractedWorkflowItem,
  candidates: VerifiedProductCandidate[],
): ProductMatchResult {
  const itemName = normalize([
    item.identityFingerprint,
    item.productName,
    item.model,
    item.supplierSku,
    item.variantOrFinish,
  ].filter(Boolean).join(" "));
  const itemBrand = normalize(item.brand || item.manufacturer);
  const itemSupplier = normalize(item.supplierName || item.supplier);

  let bestCandidate: VerifiedProductCandidate | undefined;
  let bestScore = 0;
  let bestReason = "No approved local product database match found.";

  for (const candidate of candidates.filter(isVerifiedCandidate)) {
    const candidateName = normalize(candidate.productName);
    const candidateBrand = normalize(candidate.brand || candidate.manufacturer);
    const nameScore = tokenSimilarity(itemName, candidateName);
    const brandMatches = Boolean(itemBrand && candidateBrand && itemBrand === candidateBrand);
    const supplierHintMatches = Boolean(itemSupplier && candidateName && tokenSimilarity(itemSupplier, candidateName) >= 40);
    const exactName = Boolean(itemName && candidateName && itemName === candidateName);
    const score = exactName
      ? brandMatches || !itemBrand
        ? 96
        : 88
      : Math.min(89, nameScore + (brandMatches ? 10 : 0) + (supplierHintMatches ? 4 : 0));

    if (score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
      bestReason = exactName
        ? `Exact approved product name${brandMatches ? " and brand" : ""} match in local database.`
        : `Fuzzy approved product match in local database (${nameScore}% name token overlap${brandMatches ? ", brand matched" : ""}).`;
    }
  }

  return classifyMatch({
    item,
    candidate: bestCandidate,
    score: bestScore,
    reason: bestReason,
  });
}

export function matchExtractedItemsToVerifiedProducts(
  items: ExtractedWorkflowItem[],
  candidates: VerifiedProductCandidate[],
) {
  return items.map((item) => matchExtractedItemToVerifiedProduct(item, candidates));
}

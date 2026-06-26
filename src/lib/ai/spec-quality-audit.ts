import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import { findGenericGluedOcrTokens } from "@/lib/ai/spec-normalize";

export type SpecQualityAuditIssue =
  | "diagnostic_leak"
  | "ocr_spacing"
  | "glued_words"
  | "ocr_misspelling"
  | "suspicious_token_density";

export type SpecQualityAuditStatus = "pass" | "needs_cleanup" | "needs_human_review";

export type SpecQualityAuditItemResult = {
  item_index: number;
  status: SpecQualityAuditStatus;
  issues: SpecQualityAuditIssue[];
  examples: string[];
};

export type SpecQualityAuditSummary = {
  enabled: boolean;
  checkedCount: number;
  passCount: number;
  needsCleanupCount: number;
  needsHumanReviewCount: number;
  issueCounts: Record<string, number>;
  items: SpecQualityAuditItemResult[];
};

const splitWordPatterns: Array<[RegExp, string]> = [
  [/\bstand\s+ing\b/gi, "stand ing"],
  [/\bstand\s*ingfacing\b/gi, "stand ingfacing"],
  [/\bWhenst\s*and\s*ing\b/gi, "Whenst and ing"],
  [/\bfree\s+stand\s+ing\b/gi, "free stand ing"],
  [/\brein\s+for\s+ced\b/gi, "rein for ced"],
  [/\bthe\s+rmostat\b/gi, "the rmostat"],
  [/\bCus\s+to\s+msize\b/gi, "Cus to msize"],
  [/\bCustom\s+msize\b/gi, "Custom msize"],
];

const gluedPatterns: Array<[RegExp, string]> = [
  [/\b\d+\s*l[a-z]{8,}\b/gi, "glued litre/service text"],
  [/\bkwelement\b/gi, "kwelement"],
  [/\b[a-z]{7,}(?:electric|pressure|element|thermostat|connection|powerpoint)\b/gi, "glued service token"],
  [/\bspray-brushedwarmsunset\b/gi, "spray-brushedwarmsunset"],
  [/\b(?:RHWhen|lookingat|outsideof|shelfon|sideonend|bemountedonback|overlapsbothfixedpanels|fixedpanels?|mm-slides)\b/gi, "glued shower direction token"],
];

const misspellingPatterns: Array<[RegExp, string]> = [
  [/\bthroostat\b/gi, "throostat"],
  [/\brmostat\b/gi, "rmostat"],
  [/\b(?:Jconic|lconic|Whitefaceplates|PDLIconic|lifeeasy|Vantiy|clickclackmushroom|C\/WSoft|Timekeeperplustimer|Concealedwiring)\b/gi, "common OCR spelling/spacing error"],
  [/\b(?:Waterproofmembraneunder|laidontimber|inginwetareas|veneerlaminated|astructuralplybase|straightlaid)\b/gi, "glued flooring/wet-area OCR token"],
  [/\b(?:ihen|cullery|ining|ounge|aundry|nsuitbed)\b/gi, "dropped location letters"],
];

function pushIssue(
  result: SpecQualityAuditItemResult,
  issue: SpecQualityAuditIssue,
  examples: string[],
) {
  if (!result.issues.includes(issue)) result.issues.push(issue);
  for (const example of examples) {
    if (result.examples.length >= 8) break;
    if (example && !result.examples.includes(example)) result.examples.push(example);
  }
}

function collectMatches(text: string, patterns: Array<[RegExp, string]>) {
  const matches: string[] = [];
  for (const [pattern, label] of patterns) {
    pattern.lastIndex = 0;
    const found = text.match(pattern);
    if (found?.length) matches.push(...found.slice(0, 3));
    else if (pattern.test(text)) matches.push(label);
  }
  return matches;
}

function suspiciousTokenDensity(text: string) {
  const tokens = text.match(/[a-zA-Z]{7,}/g) || [];
  if (tokens.length < 4) return false;
  const suspicious = tokens.filter((token) => {
    const lower = token.toLowerCase();
    if (/^(manufacturer|supplier|description|category|location|productcode|waterproof|engineered|conditioning|electrical|freestanding|thermostat|reinforced|standard|builder|bathroom|kitchen|scullery|laundry|ensuite|bedroom|garage|connection|powerpoint|cladding|weatherboard)$/.test(lower)) return false;
    return /(?:[bcdfghjklmnpqrstvwxyz]{5,}|[a-z]{8,}(?:electric|pressure|element|connection|powerpoint)|^[a-z]*[qwzx][a-z]*[qwzx])/.test(lower);
  });
  return suspicious.length / Math.max(tokens.length, 1) >= 0.25;
}

export function auditVisibleSpecItemText(item: Pick<ProposedSpecItem, "extracted_text" | "source_snippet">, itemIndex = 0): SpecQualityAuditItemResult {
  const text = `${item.extracted_text || ""}\n${item.source_snippet || ""}`;
  const result: SpecQualityAuditItemResult = {
    item_index: itemIndex,
    status: "pass",
    issues: [],
    examples: [],
  };

  const diagnosticMatches = text.match(/\b(?:LLMReviewLane|LLMReviewReason|candidate[_ -]?id|Has\s*Identifier|Suggested\s*Search\s*Query)\b/gi) || [];
  if (diagnosticMatches.length) pushIssue(result, "diagnostic_leak", diagnosticMatches);

  const splitMatches = collectMatches(text, splitWordPatterns);
  if (splitMatches.length) pushIssue(result, "ocr_spacing", splitMatches);

  const gluedMatches = collectMatches(text, gluedPatterns);
  const genericGluedMatches = findGenericGluedOcrTokens(text);
  if (gluedMatches.length || genericGluedMatches.length) {
    pushIssue(result, "glued_words", [...gluedMatches, ...genericGluedMatches]);
  }

  const misspellingMatches = collectMatches(text, misspellingPatterns);
  if (misspellingMatches.length) pushIssue(result, "ocr_misspelling", misspellingMatches);

  if (suspiciousTokenDensity(text)) pushIssue(result, "suspicious_token_density", ["high suspicious-token density"]);

  if (result.issues.includes("diagnostic_leak")) {
    result.status = "needs_cleanup";
  } else if (result.issues.length > 0) {
    result.status = "needs_human_review";
  }

  return result;
}

export function auditVisibleSpecItems(items: ProposedSpecItem[]): SpecQualityAuditSummary {
  const auditedItems = items.map((item, index) => auditVisibleSpecItemText(item, index));
  const issueCounts: Record<string, number> = {};
  for (const item of auditedItems) {
    for (const issue of item.issues) issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  }
  return {
    enabled: true,
    checkedCount: auditedItems.length,
    passCount: auditedItems.filter((item) => item.status === "pass").length,
    needsCleanupCount: auditedItems.filter((item) => item.status === "needs_cleanup").length,
    needsHumanReviewCount: auditedItems.filter((item) => item.status === "needs_human_review").length,
    issueCounts,
    items: auditedItems,
  };
}

export function getVisibleQualityFailureText(item: SpecQualityAuditItemResult) {
  if (item.status === "pass") return "";
  const issueList = item.issues.join(", ");
  const examples = item.examples.length ? ` Examples: ${item.examples.join("; ")}.` : "";
  return `Evidence text needs manual cleanup (${issueList}).${examples}`;
}

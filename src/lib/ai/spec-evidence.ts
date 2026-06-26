import { cleanEvidenceText, compactForMatching, isLowInformationEvidence } from "@/lib/ai/spec-normalize";

export type EvidenceRule = {
  patterns: RegExp[];
  evidenceTerms: string[];
  fallbackEvidence: string;
};

export function patternMatches(rule: Pick<EvidenceRule, "patterns">, searchableText: string, compactText: string) {
  return rule.patterns.some((pattern) => pattern.test(searchableText) || pattern.test(compactText));
}

export function scoreEvidence(text: string) {
  const cleaned = cleanEvidenceText(text);
  const words = cleaned.toLowerCase().match(/[a-z0-9]+/g) || [];
  const uniqueWordCount = new Set(words).size;
  const reasons: string[] = [];
  let score = 0;

  if (cleaned.length >= 40) score += 2;
  else reasons.push("short");

  if (uniqueWordCount >= 5) score += 2;
  else reasons.push("low_unique_word_count");

  if (/\b(?:selected|range|finish|colour|color|supplier|model|code|mm|warranty|manual|quote|tile|paint|door|carpet|light|mixer|vanity|toilet|air\s*conditioning|airconditioning|ducted|hvac)\b/i.test(cleaned)) {
    score += 2;
  } else {
    reasons.push("no_handover_signal");
  }

  if (isLowInformationEvidence(cleaned)) {
    score -= 4;
    reasons.push("low_information_repeated_heading");
  }

  if (/\b([A-Z][A-Z\s/&-]{4,})\b(?:\s+\1){1,}/.test(cleaned)) {
    score -= 2;
    reasons.push("repeated_heading_text");
  }

  return { score, reasons };
}

export function chooseBestEvidence(rule: EvidenceRule, chunks: string[], fullText: string) {
  const cleanedChunks = chunks
    .map((chunk) => cleanEvidenceText(chunk))
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => ({ chunk, quality: scoreEvidence(chunk) }))
    .filter(({ quality }) => quality.score > -1);

  const termEvidenceChunk = cleanedChunks
    .flatMap(({ chunk, quality }) =>
      rule.evidenceTerms
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => chunk.toLowerCase().includes(candidate.toLowerCase()))
        .map(({ index }) => {
          const patternMatched = patternMatches(rule, chunk.toLowerCase(), compactForMatching(chunk));
          return {
            chunk,
            score: quality.score + (patternMatched ? 8 : 0) + Math.max(0, rule.evidenceTerms.length - index),
          };
        }),
    )
    .sort((a, b) => b.score - a.score)[0]?.chunk;

  const patternEvidenceChunk = cleanedChunks.find(({ chunk }) => {
    const normal = chunk.toLowerCase();
    const compact = compactForMatching(chunk);
    return patternMatches(rule, normal, compact);
  })?.chunk;

  const source = termEvidenceChunk || patternEvidenceChunk || fullText;
  const normalSource = cleanEvidenceText(source);
  const lowerSource = normalSource.toLowerCase();
  const term = rule.evidenceTerms.find((candidate) => lowerSource.includes(candidate.toLowerCase()));

  if (!term || normalSource.length <= 360) {
    return normalSource.slice(0, 360) || rule.fallbackEvidence;
  }

  const index = lowerSource.indexOf(term.toLowerCase());
  const start = Math.max(0, index - 120);
  const end = Math.min(normalSource.length, index + term.length + 240);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalSource.length ? "..." : "";
  return `${prefix}${normalSource.slice(start, end)}${suffix}`;
}

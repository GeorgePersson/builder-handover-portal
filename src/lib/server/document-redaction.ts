export type DocumentRedactionSummary = {
  enabled: boolean;
  emailCount: number;
  phoneCount: number;
  likelyAddressCount: number;
  clientReferenceCount: number;
  totalReplacementCount: number;
};

type RedactionRule = {
  key: keyof Omit<DocumentRedactionSummary, "enabled" | "totalReplacementCount">;
  pattern: RegExp;
  replacement: string;
};

const redactionRules: RedactionRule[] = [
  {
    key: "emailCount",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    key: "phoneCount",
    pattern: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3}[-.\s]?\d{3,4}\b/g,
    replacement: "[REDACTED_PHONE]",
  },
  {
    key: "likelyAddressCount",
    pattern: /\b\d{1,5}\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,4}\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Place|Pl|Terrace|Tce|Way|Court|Ct|Crescent|Cres)\b/gi,
    replacement: "[REDACTED_ADDRESS]",
  },
  {
    key: "clientReferenceCount",
    pattern: /\b(?:client|homeowner|owner|customer)\s*(?:name|email|phone|mobile|address)?\s*[:=-]\s*[^,\n\r]+/gi,
    replacement: "[REDACTED_CLIENT_REFERENCE]",
  },
];

export function redactDocumentText(input: string) {
  const summary: DocumentRedactionSummary = {
    enabled: true,
    emailCount: 0,
    phoneCount: 0,
    likelyAddressCount: 0,
    clientReferenceCount: 0,
    totalReplacementCount: 0,
  };

  let text = input;

  for (const rule of redactionRules) {
    text = text.replace(rule.pattern, (match) => {
      summary[rule.key] += 1;
      summary.totalReplacementCount += 1;

      const trailingComma = match.endsWith(",") ? "," : "";
      return `${rule.replacement}${trailingComma}`;
    });
  }

  return {
    text,
    summary,
  };
}


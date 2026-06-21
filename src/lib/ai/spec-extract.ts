import { shouldExcludeAsAdminNoise } from "@/lib/ai/extraction-guardrails";

export type ProposedSpecItem = {
  item_type: "product" | "maintenance" | "document";
  title: string;
  category: string;
  location: string;
  extracted_text: string;
  source_snippet?: string;
  source_page?: number | null;
  matched_existing_record: string | null;
  confidence_score: number;
  recommended_action:
    | "attach_existing_product"
    | "attach_existing_task"
    | "manual_review"
    | "request_document"
    | "review_new_product";
};

type ExtractionRule = {
  item_type: ProposedSpecItem["item_type"];
  title: string;
  category: string;
  location: string;
  patterns: RegExp[];
  evidenceTerms: string[];
  matched_existing_record?: string;
  confidence_score: number;
  recommended_action: ProposedSpecItem["recommended_action"];
  fallbackEvidence: string;
};

export function getInitialExtractedItemStatus(item: Pick<ProposedSpecItem, "matched_existing_record" | "confidence_score">) {
  if (item.matched_existing_record && item.confidence_score >= 75) {
    return "auto_approved" as const;
  }

  return "admin_review" as const;
}

function normalizeForMatching(text: string) {
  return text
    .replace(/<!--[^>]*-->/g, " ")
    .replace(/→/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/([a-z]{3,})(to|from|with|and|for|the|wall|floor|door|window|shower|bathroom|kitchen|client|builder|hardware|paint|finish|tiles|tiled|selected)/gi, "$1 $2")
    .replace(/(to|from|with|and|for|the|wall|floor|door|window|shower|bathroom|kitchen|client|builder|hardware|paint|finish|tiles|tiled|selected)([a-z]{3,})/gi, "$1 $2")
    .replace(/[\t|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanEvidenceText(text: string) {
  return normalizeForMatching(text)
    .replace(/\bimage\b/gi, " ")
    .replace(/\bBuilder\s*\(Initial\)\b/gi, " ")
    .replace(/\bClient\s*\(Initial\)\b/gi, " ")
    .replace(/\(Initial\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactForMatching(text: string) {
  return normalizeForMatching(text).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitIntoEvidenceChunks(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeForMatching(line))
    .filter((line) => line.length > 0);

  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isHeading = /^#{1,4}\s+/.test(line) || /^[A-Z][A-Z\s/&-]{8,}$/.test(line);
    const wouldBeTooLong = current.join(" ").length + line.length > 900;

    if ((isHeading || wouldBeTooLong) && current.length > 0) {
      chunks.push(current.join(" "));
      current = [];
    }

    current.push(line.replace(/^#{1,4}\s+/, ""));
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks.length > 0 ? chunks : [normalizeForMatching(text)];
}

function patternMatches(rule: ExtractionRule, searchableText: string, compactText: string) {
  return rule.patterns.some((pattern) => pattern.test(searchableText) || pattern.test(compactText));
}

function findBestEvidence(rule: ExtractionRule, chunks: string[], fullText: string) {
  const evidenceChunk = chunks.find((chunk) => {
    const normal = chunk.toLowerCase();
    const compact = compactForMatching(chunk);
    return patternMatches(rule, normal, compact);
  });

  const source = evidenceChunk || fullText;
  const normalSource = cleanEvidenceText(source);
  const lowerSource = normalSource.toLowerCase();
  const term = rule.evidenceTerms.find((candidate) => lowerSource.includes(candidate.toLowerCase()));

  if (!term) {
    return normalSource.slice(0, 360) || rule.fallbackEvidence;
  }

  const index = lowerSource.indexOf(term.toLowerCase());
  const start = Math.max(0, index - 120);
  const end = Math.min(normalSource.length, index + term.length + 240);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalSource.length ? "..." : "";
  return `${prefix}${normalSource.slice(start, end)}${suffix}`;
}

function addProposal(proposals: ProposedSpecItem[], seen: Set<string>, rule: ExtractionRule, evidence: string) {
  const key = `${rule.item_type}:${rule.title.toLowerCase()}`;

  if (seen.has(key)) {
    return;
  }

  const cleanedEvidence = cleanEvidenceText(evidence);
  const extractedText = cleanedEvidence.length > 500 ? `${cleanedEvidence.slice(0, 497)}...` : cleanedEvidence;

  if (shouldExcludeAsAdminNoise(extractedText)) {
    return;
  }

  seen.add(key);
  proposals.push({
    item_type: rule.item_type,
    title: rule.title,
    category: rule.category,
    location: rule.location,
    extracted_text: extractedText || rule.fallbackEvidence,
    source_snippet: extractedText || rule.fallbackEvidence,
    source_page: null,
    matched_existing_record: rule.matched_existing_record || null,
    confidence_score: rule.confidence_score,
    recommended_action: rule.recommended_action,
  });
}

const extractionRules: ExtractionRule[] = [
  {
    item_type: "product",
    title: "Accoya weatherboard cladding",
    category: "Cladding",
    location: "Exterior envelope",
    patterns: [/accoya/i, /weather\s*board/i, /weatherboard/i, /cavity\s*batten/i, /tim\s*spec\s*p905/i],
    evidenceTerms: ["Accoya", "weatherboard", "cavity batten", "TimSpec"],
    confidence_score: 76,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references exterior weatherboard cladding.",
  },
  {
    item_type: "product",
    title: "Aluminium window and door joinery",
    category: "Joinery",
    location: "Exterior openings",
    patterns: [/aluminium/i, /window\s*joinery/i, /powder\s*coat/i, /translucent\s*laminate/i],
    evidenceTerms: ["Window Joinery", "Aluminium", "powdercoat", "translucent laminate"],
    confidence_score: 78,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references aluminium window joinery and glazing selections.",
  },
  {
    item_type: "product",
    title: "Interior flush panel doors",
    category: "Doors and hardware",
    location: "Interior",
    patterns: [/hollow\s*core/i, /flush\s*panel/i, /pre-?hung\s*doors?/i, /interior\s*door/i],
    evidenceTerms: ["Hollow core", "flush panel", "pre-hung doors", "Interior Door"],
    confidence_score: 74,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references interior hollow-core flush panel doors.",
  },
  {
    item_type: "product",
    title: "Interior door and cavity slider hardware",
    category: "Doors and hardware",
    location: "Interior",
    patterns: [/cavity\s*slider/i, /lever\s*handles?/i, /privacy\s*sets?/i, /brushed\s*nickel/i],
    evidenceTerms: ["Cavity Slider", "lever handles", "privacy sets", "Brushed Nickel"],
    confidence_score: 68,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references selected lever handles, privacy sets, or cavity slider hardware.",
  },
  {
    item_type: "product",
    title: "Bathroom and wet-area ceramic wall tiles",
    category: "Tiles",
    location: "Bathrooms and wet areas",
    patterns: [/wall\s*tiling/i, /ceramic\s*tiles/i, /ceramictiles/i, /tiled\s*shower/i, /tilesfromthebuildersrange/i],
    evidenceTerms: ["Wall Tiling", "ceramic tiles", "tiled shower", "Builder's range"],
    confidence_score: 82,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references selected ceramic wall tiles in bathrooms and wet areas.",
  },
  {
    item_type: "product",
    title: "Kitchen/scullery/laundry tiled splashbacks",
    category: "Tiles",
    location: "Kitchen, scullery, and laundry",
    patterns: [/splash\s*back/i, /splashback/i, /benchtop\s*to\s*underside/i, /laundry.*tiles/i, /scullery.*tiles/i],
    evidenceTerms: ["Splashback", "benchtop", "Scullery", "Laundry"],
    confidence_score: 73,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references tiled splashbacks or wall tiles above benches.",
  },
  {
    item_type: "product",
    title: "Interior paint finish and colour scheme",
    category: "Paint and finishes",
    location: "Interior",
    patterns: [/interior\s*colour/i, /interior\s*color/i, /semi-?gloss\s*paint/i, /flat\s*acrylic\s*paint/i, /waterborne\s*semi/i],
    evidenceTerms: ["Interior colour", "semi-gloss paint", "flat acrylic paint", "waterborne"],
    confidence_score: 76,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references interior paint colours and finish types.",
  },
  {
    item_type: "product",
    title: "Ceramic tile floor finishes",
    category: "Flooring",
    location: "Entry, kitchen, wet areas, and living areas",
    patterns: [/floor\s*finishes/i, /ceramic\s*tiles\s*area/i, /ceramic\s*tiles\s*square/i, /ceramictilessquare/i],
    evidenceTerms: ["FLOOR FINISHES", "Ceramic tiles", "entry", "kitchen"],
    confidence_score: 80,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references ceramic tile floor finishes.",
  },
  {
    item_type: "product",
    title: "Engineered timber veneer flooring",
    category: "Flooring",
    location: "Flooring and stairs",
    patterns: [/engineered\s*timber/i, /timber\s*veneer/i, /stair\s*treads?/i],
    evidenceTerms: ["Engineered Timber", "timber veneer", "Stair Treads"],
    confidence_score: 80,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references engineered timber veneer flooring.",
  },
  {
    item_type: "product",
    title: "Garage carpet",
    category: "Flooring",
    location: "Garage",
    patterns: [/garage\s*carpet/i, /garagecarpet/i],
    evidenceTerms: ["Garage Carpet", "garage floor"],
    confidence_score: 82,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references garage carpet fixed to the garage floor.",
  },
  {
    item_type: "product",
    title: "GIB board ceiling linings",
    category: "Linings",
    location: "Ceilings",
    patterns: [/gib\s*board\s*ceilings?/i, /gibboardceilings/i, /level\s*4\s*finish/i],
    evidenceTerms: ["gibboard ceilings", "level 4 finish", "CEILINGS"],
    confidence_score: 72,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references GIB board ceilings and paint finish.",
  },
  {
    item_type: "product",
    title: "Kitchen, scullery and laundry joinery",
    category: "Joinery",
    location: "Kitchen, scullery, laundry, entertainment unit",
    patterns: [/superior\s*kitchens/i, /superiorkitchens/i, /kitchen.*quote/i, /entertainment\s*unit/i],
    evidenceTerms: ["Superior Kitchens", "Kitchen", "Scullery", "Laundry", "Entertainment Unit"],
    confidence_score: 66,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references kitchen/scullery/laundry joinery by separate quote.",
  },
  {
    item_type: "product",
    title: "Bathroom mirrors and demister pads",
    category: "Bathroom fixtures",
    location: "Bathrooms and ensuites",
    patterns: [/mirror/i, /demister\s*pad/i, /st\s*michel/i, /dante\s*plus\s*mirror/i],
    evidenceTerms: ["Mirror", "Demister Pad", "St Michel", "Dante Plus"],
    confidence_score: 74,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references bathroom mirrors and demister pads.",
  },
  {
    item_type: "product",
    title: "Bathroom vanities and basins",
    category: "Bathroom fixtures",
    location: "Bathrooms and ensuites",
    patterns: [/vanity/i, /basin/i, /allure\s*1200/i, /lauretta/i],
    evidenceTerms: ["Vanity", "Basin", "Allure", "Lauretta"],
    confidence_score: 76,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references bathroom vanity, basin, colour, and drawer hardware selections.",
  },
  {
    item_type: "product",
    title: "Shower systems and niches",
    category: "Bathroom fixtures",
    location: "Bathrooms and ensuites",
    patterns: [/newline\s*shower/i, /newlineshower/i, /dry\s*fit/i, /shower\s*door/i, /niche/i],
    evidenceTerms: ["Newline shower", "DryFit", "shower door", "Niche"],
    confidence_score: 80,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references selected shower systems, doors, shelves, and niches.",
  },
  {
    item_type: "product",
    title: "Grohe kitchen mixer",
    category: "Tapware",
    location: "Kitchen",
    patterns: [/grohe/i, /essence\s*kitchen\s*mixer/i, /pullout\s*spray/i, /30270/i],
    evidenceTerms: ["Grohe", "Essence Kitchen Mixer", "pullout spray", "30270"],
    confidence_score: 86,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references a Grohe Essence kitchen mixer with pull-out spray.",
  },
  {
    item_type: "product",
    title: "Robe hooks and bathroom accessories",
    category: "Bathroom fixtures",
    location: "Bathrooms and ensuites",
    patterns: [/robe\s*hooks?/i, /heirloom\s*heiko/i, /hrhb/i],
    evidenceTerms: ["Robe Hooks", "Heirloom Heiko", "HRHB"],
    confidence_score: 70,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references robe hooks or bathroom accessory selections.",
  },
  {
    item_type: "product",
    title: "Raft slab and concrete floor system",
    category: "Structural/foundation",
    location: "Foundation and slab",
    patterns: [/raft\s*slab/i, /concrete\s*floor/i, /polythenedampproof/i, /damp\s*proof\s*membrane/i],
    evidenceTerms: ["Raft Slab", "Concrete Floor", "damp proof membrane", "reinforced"],
    confidence_score: 62,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references the raft slab and concrete floor system.",
  },
  {
    item_type: "product",
    title: "Waterproof membrane under wet-area tiles",
    category: "Waterproofing",
    location: "Wet areas",
    patterns: [/waterproof\s*membrane/i, /membrane\s*under\s*tiles/i, /wet\s*areas/i],
    evidenceTerms: ["Waterproof membrane", "wet areas", "under tiles"],
    confidence_score: 76,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references waterproof membrane under tiles in wet areas.",
  },
  {
    item_type: "product",
    title: "PVC traps and wastes",
    category: "Plumbing fixtures",
    location: "Plumbing services",
    patterns: [/pvc\s*traps/i, /traps\s*and\s*wastes/i, /click\s*clack/i, /mushroom\s*waste/i],
    evidenceTerms: ["PVC traps", "wastes", "click clack", "mushroom waste"],
    confidence_score: 70,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references plumbing traps and wastes.",
  },
  {
    item_type: "maintenance",
    title: "Clean gutters and downpipes",
    category: "Maintenance",
    location: "Roof and drainage",
    patterns: [/gutter/i, /downpipe/i, /roof\s*drainage/i],
    evidenceTerms: ["gutter", "downpipe", "roof"],
    matched_existing_record: "Clean gutters and downpipes",
    confidence_score: 82,
    recommended_action: "attach_existing_task",
    fallbackEvidence: "Specification references roof drainage components that should be maintained.",
  },
  {
    item_type: "maintenance",
    title: "Wash exterior cladding and painted finishes",
    category: "Maintenance",
    location: "Exterior envelope",
    patterns: [/weather\s*board/i, /painted/i, /exterior.*paint/i, /cladding/i, /accoya/i],
    evidenceTerms: ["weatherboard", "painted", "Accoya", "exterior"],
    matched_existing_record: "Wash exterior cladding",
    confidence_score: 84,
    recommended_action: "attach_existing_task",
    fallbackEvidence: "Exterior painted cladding finishes require regular cleaning/maintenance.",
  },
  {
    item_type: "maintenance",
    title: "Maintain tile grout and wet-area sealants",
    category: "Maintenance",
    location: "Bathrooms and wet areas",
    patterns: [/ceramic\s*tiles/i, /tiled\s*shower/i, /wet\s*areas/i, /waterproof\s*membrane/i],
    evidenceTerms: ["ceramic tiles", "tiled shower", "wet areas", "waterproof membrane"],
    confidence_score: 68,
    recommended_action: "manual_review",
    fallbackEvidence: "Wet-area tile and waterproofing selections imply grout/sealant maintenance should be reviewed.",
  },
  {
    item_type: "maintenance",
    title: "Maintain engineered timber flooring",
    category: "Maintenance",
    location: "Flooring",
    patterns: [/engineered\s*timber/i, /timber\s*veneer/i],
    evidenceTerms: ["Engineered Timber", "timber veneer"],
    confidence_score: 66,
    recommended_action: "manual_review",
    fallbackEvidence: "Engineered timber flooring care requirements should be confirmed for handover.",
  },
  {
    item_type: "maintenance",
    title: "Clean and maintain shower glass and hardware",
    category: "Maintenance",
    location: "Bathrooms and ensuites",
    patterns: [/shower\s*door/i, /chrome\s*hardware/i, /brushed\s*nickel\s*hardware/i, /sliding\s*door/i],
    evidenceTerms: ["shower door", "Chrome Hardware", "Brushed Nickel Hardware", "Sliding Door"],
    confidence_score: 66,
    recommended_action: "manual_review",
    fallbackEvidence: "Shower doors and hardware require homeowner cleaning and maintenance guidance.",
  },
  {
    item_type: "document",
    title: "Producer statements and code compliance documents",
    category: "Compliance document",
    location: "Handover pack",
    patterns: [/producer\s*statement/i, /ps[1-4]\b/i, /code\s*compliance/i, /\bccc\b/i],
    evidenceTerms: ["Producer", "PS", "Code Compliance", "CCC"],
    confidence_score: 74,
    recommended_action: "request_document",
    fallbackEvidence: "Specification references compliance documents for the handover pack.",
  },
  {
    item_type: "document",
    title: "Product warranties and maintenance manuals",
    category: "Handover document",
    location: "Handover pack",
    patterns: [/warrant(?:y|ies)/i, /manuals?/i, /care\s*guide/i, /maintenance\s*manual/i],
    evidenceTerms: ["warranty", "manual", "care guide", "maintenance"],
    confidence_score: 64,
    recommended_action: "request_document",
    fallbackEvidence: "Handover package should collect warranties and maintenance manuals for selected products.",
  },
  {
    item_type: "document",
    title: "Kitchen and joinery supplier quote/source document",
    category: "Source document",
    location: "Builder records",
    patterns: [/superior\s*kitchens\s*quote/i, /asper\s*superior\s*kitchens/i, /joinery.*quote/i],
    evidenceTerms: ["Superior Kitchens quote", "As per Superior Kitchens", "joinery"],
    confidence_score: 70,
    recommended_action: "request_document",
    fallbackEvidence: "Specification refers to a separate kitchen/joinery quote that should be attached as source evidence.",
  },
];

const fallbackRules: ExtractionRule[] = [
  {
    item_type: "product",
    title: "Heat pump system",
    category: "Heating/cooling",
    location: "Services",
    patterns: [/heat\s*pump/i, /heating/i, /cooling/i, /hvac/i],
    evidenceTerms: ["heat pump", "heating", "cooling", "HVAC"],
    confidence_score: 62,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references heating or cooling equipment; exact model should be confirmed.",
  },
  {
    item_type: "product",
    title: "Kitchen appliances",
    category: "Appliance",
    location: "Kitchen",
    patterns: [/dishwasher/i, /oven/i, /cooktop/i, /rangehood/i, /appliance/i],
    evidenceTerms: ["dishwasher", "oven", "cooktop", "rangehood", "appliance"],
    confidence_score: 58,
    recommended_action: "review_new_product",
    fallbackEvidence: "Specification references kitchen appliances; exact models should be confirmed.",
  },
];

export function buildSpecificationProposals(extractedText: string): ProposedSpecItem[] {
  const normalizedText = normalizeForMatching(extractedText);
  const searchableText = normalizedText.toLowerCase();
  const compactText = compactForMatching(extractedText);
  const chunks = splitIntoEvidenceChunks(extractedText);
  const proposals: ProposedSpecItem[] = [];
  const seen = new Set<string>();

  const containsOnlyAdminNoise = shouldExcludeAsAdminNoise(extractedText);

  if (containsOnlyAdminNoise) {
    return [];
  }

  for (const rule of extractionRules) {
    if (!patternMatches(rule, searchableText, compactText)) {
      continue;
    }

    addProposal(proposals, seen, rule, findBestEvidence(rule, chunks, normalizedText));
  }

  for (const rule of fallbackRules) {
    if (!patternMatches(rule, searchableText, compactText)) {
      continue;
    }

    addProposal(proposals, seen, rule, findBestEvidence(rule, chunks, normalizedText));
  }

  if (proposals.length > 0) {
    return proposals;
  }

  return [
    {
      item_type: "product",
      title: "Unclassified specification item",
      category: "To review",
      location: "Project",
      extracted_text: "AI could not confidently classify the supplied text. Builder review is required.",
      source_snippet: "AI could not confidently classify the supplied text. Builder review is required.",
      source_page: null,
      matched_existing_record: null,
      confidence_score: 28,
      recommended_action: "manual_review",
    },
  ];
}

import { shouldExcludeAsAdminNoise } from "@/lib/ai/extraction-guardrails";
import { classifySpecRow, getReviewReasonForLane, reviewLaneToRecommendedAction } from "@/lib/ai/spec-classify";
import { chooseBestEvidence, patternMatches } from "@/lib/ai/spec-evidence";
import {
  cleanEvidenceText,
  compactForMatching,
  dedupeCells,
  hasRepeatedCells,
  isSeparatorRow,
  normalizeExtractedTitle,
  normalizeSpecText,
  splitTableCells,
} from "@/lib/ai/spec-normalize";

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
    | "request_more_context"
    | "needs_source_document"
    | "needs_model_code"
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

type ServiceAssetPattern = {
  title: string;
  category: string;
  patterns: RegExp[];
  terms: string[];
};

const serviceAssetPatterns: ServiceAssetPattern[] = [
  {
    title: "Underfloor heating",
    category: "Heating/cooling",
    patterns: [/under\s*floor\s*heating/i, /underfloor\s*heating/i, /floor\s*heating/i, /heating\s*mat/i, /heated\s*floor/i],
    terms: ["underfloor heating", "under floor heating", "floor heating", "heating mat", "heated floor"],
  },
  {
    title: "Ducted air conditioning",
    category: "Heating/cooling",
    patterns: [/ducted\s*air\s*conditioning/i, /air\s*conditioning\s*unit/i, /airconditioning\s*unit/i, /air\s*conditioning/i, /airconditioning/i],
    terms: ["ducted air conditioning", "air conditioning unit", "airconditioning unit", "air conditioning", "airconditioning"],
  },
  {
    title: "Hot water cylinder",
    category: "Plumbing fixtures",
    patterns: [/hot\s*water\s*cylinder/i, /hotwater\s*cylinder/i, /mains\s*pressure\s*electric/i],
    terms: ["hot water cylinder", "hotwater cylinder", "mains pressure electric"],
  },
  {
    title: "Solar power prewire",
    category: "Electrical",
    patterns: [/prewire\s*only\s*for\s*future\s*solar/i, /solar\s*power/i],
    terms: ["future solar", "solar power", "solar"],
  },
  {
    title: "External pump power connection",
    category: "Electrical",
    patterns: [/external\s*(?:swimming\s*pool|domestic\s*water)\s*pump/i, /pump\s*and\s*filtration/i],
    terms: ["external swimming pool pump", "domestic water pump", "pump and filtration"],
  },
  {
    title: "Security system",
    category: "Security",
    patterns: [/security\s*system/i, /electronic\s*security\s*system/i, /infrared\s*sensors?/i],
    terms: ["security system", "electronic security system", "infrared sensors"],
  },
  {
    title: "Data and network outlets",
    category: "Electrical",
    patterns: [/data\s*outlets?/i, /rj\s*45/i, /patch\s*panel/i, /cat\s*6\s*cables?/i],
    terms: ["data outlets", "RJ45", "patch panel", "Cat6"],
  },
  {
    title: "Gas fireplace",
    category: "Heating/cooling",
    patterns: [/gas\s*fire/i, /gas\s*fireplace/i],
    terms: ["gas fire", "gas fireplace"],
  },
];

export function getInitialExtractedItemStatus(
  item: Pick<ProposedSpecItem, "matched_existing_record" | "confidence_score"> &
    Partial<Pick<ProposedSpecItem, "recommended_action">>,
) {
  if (item.matched_existing_record && item.confidence_score >= 75) {
    return "auto_approved" as const;
  }

  if (item.recommended_action === "needs_source_document" || item.recommended_action === "request_document") {
    return "needs_source_document" as const;
  }

  if (item.recommended_action === "needs_model_code") {
    return "needs_model_code" as const;
  }

  if (item.recommended_action === "request_more_context") {
    return "request_more_context" as const;
  }

  return "admin_review" as const;
}

export function getInitialExtractedItemReviewReason(item: ProposedSpecItem) {
  return getReviewReasonForLane(item);
}

function proposalKey(itemType: ProposedSpecItem["item_type"], title: string) {
  return `${itemType}:${compactForMatching(title)}`;
}

function findServiceAssetPattern(text: string) {
  const compact = compactForMatching(text);
  return serviceAssetPatterns.find((asset) =>
    asset.patterns.some((pattern) => pattern.test(text) || pattern.test(compact)),
  );
}

function hasServiceAssetSignal(text: string) {
  return Boolean(findServiceAssetPattern(text));
}

function isRepeatedLowValueRow(cells: string[], rowText: string) {
  return hasRepeatedCells(cells) && !hasServiceAssetSignal(rowText);
}

function splitIntoEvidenceChunks(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeSpecText(line))
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

  // Prefer original table/markdown lines as evidence before broader chunks.
  // Docling table rows often contain the cleanest source sentence/cell; merged
  // chunks can accidentally pull in adjacent rows, footers, or image placeholders.
  return lines.length > 0 ? [...lines, ...chunks] : [normalizeSpecText(text)];
}

function addProposal(proposals: ProposedSpecItem[], seen: Set<string>, rule: ExtractionRule, evidence: string) {
  const title = normalizeExtractedTitle(rule.title);
  const key = proposalKey(rule.item_type, title);

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
    title,
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

const knownBrands = [
  "Accoya",
  "Art Ceram",
  "Bosch",
  "Escea",
  "Fisher & Paykel",
  "Grohe",
  "Heirloom",
  "Insinkerator",
  "Newline",
  "Panasonic",
  "Parisi",
  "PDL",
  "Robertson",
  "Robertsons",
  "Schlage",
  "St Michel",
  "Superior Kitchens",
  "Victoria + Albert",
  "Windsor",
];

const productRowTerms = [
  "accoya",
  "air conditioning",
  "airconditioning",
  "aluminium",
  "appliance",
  "basin",
  "bath",
  "carpet",
  "cladding",
  "concrete",
  "cooktop",
  "ducted",
  "door",
  "downpipe",
  "floor",
  "garage",
  "gib",
  "handle",
  "hardware",
  "hook",
  "joinery",
  "light",
  "membrane",
  "mirror",
  "mixer",
  "oven",
  "paint",
  "rangehood",
  "shower",
  "slab",
  "splashback",
  "tap",
  "tile",
  "toilet",
  "vanity",
  "waste",
  "window",
];

function extractMarkdownTableRows(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|") && line.trim().endsWith("|") && !isSeparatorRow(line))
    .map((line) => splitTableCells(line))
    .filter((cells) => cells.length >= 2);
}

function findKnownBrand(text: string) {
  const compact = compactForMatching(text);
  return knownBrands.find((brand) => compact.includes(compactForMatching(brand))) || "";
}

function extractProductCodes(text: string) {
  const matches = text.match(/\b[A-Z]{1,5}\s?\d{2,6}[A-Z0-9.-]*\b|\b\d{4,6}[A-Z]{0,3}\d?\b/g) || [];
  return Array.from(new Set(matches)).slice(0, 4).join(", ");
}

function extractSize(text: string) {
  return text.match(/\b\d{2,4}\s*[×x]\s*\d{2,4}(?:\s*[×x]\s*\d{2,4})?\s*(?:mm|m)?\b/i)?.[0] || "";
}

function extractFinish(text: string) {
  return (
    text.match(/\b(?:brushed warm sunset|brushed nickel|satin nickel|blackened teak|dark grey|chrome|black|white gloss|powdercoat|powder coat|semi-gloss|stainless steel|copper terazzo)\b/i)?.[0] || ""
  );
}

function inferCategory(text: string) {
  const serviceAsset = findServiceAssetPattern(text);
  if (serviceAsset) return serviceAsset.category;

  const lower = text.toLowerCase();

  if (/mixer|tap|waste/.test(lower)) return "Tapware";
  if (/vanity|basin|toilet|bath|robe hook|mirror|shower/.test(lower)) return "Bathroom fixtures";
  if (/tile|splashback|hearth/.test(lower)) return "Tiles";
  if (/floor|carpet/.test(lower)) return "Flooring";
  if (/door|handle|hinge|hardware/.test(lower)) return "Doors and hardware";
  if (/window|joinery/.test(lower)) return "Joinery";
  if (/paint|finish|colour/.test(lower)) return "Paint and finishes";
  if (/gib|ceiling|lining/.test(lower)) return "Linings";
  if (/light|pdl|power|switch/.test(lower)) return "Electrical";
  if (/air\s*conditioning|airconditioning|ducted|heat\s*pump|heating|cooling|hvac/.test(lower)) return "Heating/cooling";
  if (/cladding|weatherboard/.test(lower)) return "Cladding";
  if (/slab|concrete|membrane/.test(lower)) return "Structural/foundation";
  if (/appliance|cooktop|oven|dishwasher|rangehood/.test(lower)) return "Appliance";

  return "Product to review";
}

function inferLocation(text: string) {
  const locations = [
    "Master Ensuite",
    "Main Bathroom",
    "Bathroom",
    "Powder Room",
    "Ensuite Bed 1 & 2",
    "Ensuite Bed 1&2",
    "Ensuite Bed 1",
    "Ensuite Bed 2",
    "Kitchen",
    "Scullery",
    "Laundry",
    "Garage",
    "Exterior",
    "Level 1",
    "Level 2",
    "Level 3",
  ];
  const compact = compactForMatching(text);
  return locations.find((location) => compact.includes(compactForMatching(location))) || "";
}

function rowHasProductSignal(rowText: string) {
  const lower = rowText.toLowerCase();
  return Boolean(
    findKnownBrand(rowText) ||
      extractProductCodes(rowText) ||
      hasServiceAssetSignal(rowText) ||
      productRowTerms.some((term) => lower.includes(term)),
  );
}

function makeReadableTitle(cells: string[], rowText: string) {
  const label = cells[0] || "Specification item";
  const brand = findKnownBrand(rowText);
  const compactLabel = compactForMatching(label);

  if (/interior\s+colour\s+scheme|semi-gloss\s+paint|flat\s+acrylic\s+paint/i.test(rowText)) {
    return "Interior paint finish and colour scheme";
  }

  if (/gib\s*board\s*ceilings?|gibboard\s*ceilings?|level\s*4\s*finish/i.test(rowText)) {
    return "GIB board ceiling linings";
  }

  const serviceAsset = findServiceAssetPattern(rowText);
  if (serviceAsset) {
    return serviceAsset.title;
  }

  if (brand && /mixer|basin|vanity|mirror|toilet|hook|waste|shower|door|light/.test(rowText.toLowerCase())) {
    const productType =
      rowText.match(/\b(?:Kitchen Mixer|Basin Mixer|Vanity|Mirror|Toilet(?:Suite)?|Robe Hook|Waste|Shower|Door|Light(?: strip)?)\b/i)?.[0] ||
      label;
    return normalizeExtractedTitle(`${brand} ${productType}`);
  }

  if (/^(type|model|size|finish|hardware|code)$/i.test(label) && cells[1]) {
    return normalizeExtractedTitle(cells[1].slice(0, 80));
  }

  if (compactLabel.length < 4 && cells[1]) {
    return normalizeExtractedTitle(cells[1].slice(0, 80));
  }

  const title = label.length > 100 ? label.slice(0, 97) + "..." : label;
  return normalizeExtractedTitle(title);
}

function cleanStructuredDescription(cells: string[]) {
  return dedupeCells(cells).join(" | ");
}

function buildStructuredEvidence(cells: string[], rowText: string) {
  const title = makeReadableTitle(cells, rowText);
  const manufacturer = findKnownBrand(rowText);
  const productCode = extractProductCodes(rowText);
  const finish = extractFinish(rowText);
  const size = extractSize(rowText);
  const category = inferCategory(rowText);
  const location = inferLocation(rowText);
  const description = cleanStructuredDescription(cells);
  const hasIdentifier = Boolean(manufacturer && (productCode || /model|series|range|essence|dante|allure|city|heiko|linfa/i.test(rowText)));
  const suggestedSearchQuery = hasIdentifier
    ? [manufacturer, productCode || title, "manual warranty specification"].filter(Boolean).join(" ")
    : "";

  return [
    `Name: ${title}`,
    manufacturer ? `Manufacturer/Supplier: ${manufacturer}` : "",
    productCode ? `ProductCode: ${productCode}` : "",
    finish ? `Finish: ${finish}` : "",
    size ? `Size: ${size}` : "",
    `Category: ${category}`,
    location ? `Location: ${location}` : "",
    `Description: ${description}`,
    `HasIdentifier: ${hasIdentifier ? "true" : "false"}`,
    suggestedSearchQuery ? `SuggestedSearchQuery: ${suggestedSearchQuery}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function addSchemaRowProposals(proposals: ProposedSpecItem[], seen: Set<string>, extractedText: string) {
  const rows = extractMarkdownTableRows(extractedText);

  for (const cells of rows) {
    const uniqueCells = dedupeCells(cells);
    const rowText = cleanEvidenceText(uniqueCells.join(" | "));
    const label = uniqueCells[0] || "";

    if (
      rowText.length < 24 ||
      rowText.length > 1_400 ||
      isRepeatedLowValueRow(cells, rowText) ||
      /^please\s+note:?$/i.test(label) ||
      !rowHasProductSignal(rowText) ||
      shouldExcludeAsAdminNoise(rowText)
    ) {
      continue;
    }

    const title = makeReadableTitle(uniqueCells, rowText);
    const category = inferCategory(rowText);
    const manufacturer = findKnownBrand(rowText);
    const productCode = extractProductCodes(rowText);
    const reviewLane = classifySpecRow({
      itemType: "product",
      title,
      rowText,
      manufacturer,
      productCode,
      category,
    });
    const recommendedAction = reviewLaneToRecommendedAction(reviewLane);
    const key = proposalKey("product", title);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    proposals.push({
      item_type: "product",
      title,
      category,
      location: inferLocation(rowText) || "Project",
      extracted_text: buildStructuredEvidence(uniqueCells, rowText).slice(0, 1_500),
      source_snippet: rowText.slice(0, 700),
      source_page: null,
      matched_existing_record: null,
      confidence_score: manufacturer || productCode ? 72 : 55,
      recommended_action: recommendedAction,
    });
  }
}

export function buildSpecificationExtractionAudit(extractedText: string, proposalsInput?: ProposedSpecItem[]) {
  const rows = extractMarkdownTableRows(extractedText);
  const proposals = proposalsInput || buildSpecificationProposals(extractedText);
  const proposalTitles = new Set(proposals.map((item) => item.title));
  const skippedSignalRows: Array<{ title: string; category: string; reason: string; source: string }> = [];
  let signalRowCount = 0;
  let extractableRowCount = 0;

  for (const cells of rows) {
    const uniqueCells = dedupeCells(cells);
    const rowText = cleanEvidenceText(uniqueCells.join(" | "));
    const label = uniqueCells[0] || "";
    const hasSignal = rowHasProductSignal(rowText);

    if (hasSignal) {
      signalRowCount += 1;
    }

    const skipReason =
      rowText.length < 24 ? "short" :
      rowText.length > 1_400 ? "too_long" :
      isRepeatedLowValueRow(cells, rowText) ? "repeated_low_value" :
      /^please\s+note:?$/i.test(label) ? "please_note" :
      !hasSignal ? "no_product_signal" :
      shouldExcludeAsAdminNoise(rowText) ? "admin_noise" :
      "";

    if (!skipReason) {
      extractableRowCount += 1;
      const title = makeReadableTitle(uniqueCells, rowText);
      if (!proposalTitles.has(title)) {
        skippedSignalRows.push({
          title,
          category: inferCategory(rowText),
          reason: "signal_row_not_in_proposals",
          source: rowText.slice(0, 240),
        });
      }
    } else if (hasSignal && skipReason !== "repeated_low_value") {
      skippedSignalRows.push({
        title: makeReadableTitle(uniqueCells, rowText),
        category: inferCategory(rowText),
        reason: skipReason,
        source: rowText.slice(0, 240),
      });
    }
  }

  return {
    tableRowCount: rows.length,
    signalRowCount,
    extractableRowCount,
    proposalCount: proposals.length,
    skippedSignalRowCount: skippedSignalRows.length,
    skippedSignalRows: skippedSignalRows.slice(0, 40),
  };
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
    evidenceTerms: ["Ceramic tiles Area", "Ceramic tiles", "entry", "kitchen"],
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
    patterns: [/heat\s*pump/i, /hvac/i],
    evidenceTerms: ["heat pump", "HVAC"],
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
  const normalizedText = normalizeSpecText(extractedText);
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

    addProposal(proposals, seen, rule, chooseBestEvidence(rule, chunks, normalizedText));
  }

  for (const rule of fallbackRules) {
    if (!patternMatches(rule, searchableText, compactText)) {
      continue;
    }

    addProposal(proposals, seen, rule, chooseBestEvidence(rule, chunks, normalizedText));
  }

  addSchemaRowProposals(proposals, seen, extractedText);

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

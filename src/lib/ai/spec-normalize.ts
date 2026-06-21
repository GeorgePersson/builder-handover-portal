const ocrPhraseFixes: Array<[RegExp, string]> = [
  [/\bFinalpositionsofall\b/gi, "Final positions of all"],
  [/\bInternalreticulation\b/gi, "Internal reticulation"],
  [/\bBlockworkonfooting\b/gi, "Blockwork on footing"],
  [/\bHollowcoreflushpanel\b/gi, "Hollow core flush panel"],
  [/\bTo\s*iletroll\b/gi, "Toilet roll"],
  [/\bTo\s*ilet\b/gi, "Toilet"],
  [/\bHand\s*les\b/gi, "Handles"],
  [/\bleverhand\s*les\b/gi, "lever handles"],
  [/\bto\s*iletrollholder\b/gi, "toilet roll holder"],
  [/\bTo\s*welwarmer\b/gi, "Towel warmer"],
  [/\bTimberl\s*and\b/gi, "Timberland"],
  [/\bwea\s*the\s*rboard\b/gi, "weatherboard"],
  [/\bfloor\s*ing\b/gi, "flooring"],
  [/\bsquote\b/gi, "s quote"],
  [/\bKitchen\s+s\s+quote\b/gi, "Kitchens quote"],
  [/\bTo\s*wel\b/gi, "Towel"],
  [/\bGasheating\b/gi, "Gas heating"],
  [/\bNZWool\b/g, "NZ Wool"],
  [/\bmmx\b/gi, "mm x"],
  [/\bbedroomorgarage\b/gi, "bedroom or garage"],
  [/\bcabinetry,wardrobeorgarage\b/gi, "cabinetry, wardrobe or garage"],
  [/\bwillbedeterminedonsiteby\b/gi, "will be determined onsite by"],
  [/\bitemswillbedeterminedonsiteby\b/gi, "items will be determined onsite by"],
  [/\bto\s*belocated\b/gi, "to be located"],
  [/\bto\s*confirmpositionsonsite\b/gi, "to confirm positions onsite"],
  [/Interiorcolourscheme/gi, "Interior colour scheme "],
  [/\bfourcolours\b/gi, "four colours"],
  [/\bcolour(\d+)/gi, "colour $1"],
  [/\bwaterbornesemi-gloss\b/gi, "waterborne semi-gloss"],
  [/\bSemi-glosspaintfinish\b/gi, "Semi-gloss paint finish"],
  [/\bflushpanelpre-hungdoors\b/gi, "flush panel pre-hung doors"],
  [/\bHollowcore\b/gi, "Hollow core"],
  [/\bmmpineflushjamb\b/gi, "mm pine flush jamb"],
  [/\bforarchitraves\b/gi, "for architraves"],
  [/\bSelectedst\s*and\s*ard\b/gi, "Selected standard"],
  [/\bfree\s*stand\s*ing\b/gi, "freestanding"],
  [/\bfreest\s*and\s*ing\b/gi, "freestanding"],
  [/\bthe\s*Builder'?s\s*range\b/gi, "the Builder's range"],
  [/\bBuilder'?s\s*range\b/gi, "Builder's range"],
  [/\btiles\s*from\s*the\s*Builder'?s\s*range\b/gi, "tiles from the Builder's range"],
  [/\bceramic\s*tiles\s*from\s*the\s*Builder'?s\s*range\b/gi, "ceramic tiles from the Builder's range"],
  [/\bAll\s*walls\s*tiled\s*floor\s*to\s*ceiling\b/gi, "All walls tiled floor to ceiling"],
  [/\btiled\s*shower\b/gi, "tiled shower"],
  [/\btiled\s*feature\s*wall\b/gi, "tiled feature wall"],
  [/\bTiled\s*into\s*window\s*recess\b/gi, "Tiled into window recess"],
  [/\bwindow\s*jam\b/gi, "window jamb"],
  [/\bnewst\s*and\s*ard\b/gi, "new standard"],
  [/\binresidential\b/gi, "in residential"],
  [/\baccessoriesthatdelivers\b/gi, "accessories that deliver"],
  [/\bRein\s*for\s*cedconcretefooting\b/gi, "Reinforced concrete footing"],
  [/\bGaragecarpetgluefixed\b/gi, "Garage carpet glue fixed"],
  [/\bgasfireplaceappliance\b/gi, "gas fireplace appliance"],
  [/\bInsinkera\s*to\s*rmultitap\b/gi, "Insinkerator multitap"],
  [/\birresistiblybeautiful\b/gi, "irresistibly beautiful"],
];

export function applyOcrPhraseFixes(text: string) {
  return ocrPhraseFixes.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

export function normalizeSpecText(text: string) {
  const normalized = applyOcrPhraseFixes(text)
    .replace(/<!--[^>]*-->/g, " ")
    .replace(/→/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/([a-z]{3,})(to|from|with|and|for|the|wall|floor|door|window|shower|bathroom|kitchen|client|builder|hardware|paint|finish|tiles|tiled|selected)/gi, "$1 $2")
    .replace(/(to|from|with|and|for|the|wall|floor|door|window|shower|bathroom|kitchen|client|builder|hardware|paint|finish|tiles|tiled|selected)([a-z]{3,})/gi, "$1 $2")
    .replace(/[\t|]+/g, " ");

  return applyOcrPhraseFixes(normalized).replace(/\s+/g, " ").trim();
}

export function collapseRepeatedTail(text: string) {
  const words = text.split(/\s+/).filter(Boolean);

  for (let size = Math.floor(words.length / 2); size >= 5; size -= 1) {
    const tail = words.slice(-size).join(" ").toLowerCase();
    const beforeTail = words.slice(-size * 2, -size).join(" ").toLowerCase();

    if (tail && tail === beforeTail) {
      return words.slice(0, -size).join(" ");
    }
  }

  return text;
}

export function cleanEvidenceText(text: string) {
  const cleaned = normalizeSpecText(text)
    .replace(/\bimage\b/gi, " ")
    .replace(/\bBuilder\s*\(Initial\)\b/gi, " ")
    .replace(/\bClient\s*\(Initial\)\b/gi, " ")
    .replace(/\bClient\b/gi, " ")
    .replace(/\bqua?ity\s+home\s+oailder\b/gi, " ")
    .replace(/\(Initial\)/gi, " ")
    .replace(/\s*-{3,}\s*/g, " ")
    .replace(/([.!?])(?=[A-Z0-9])/g, "$1 ")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  return collapseRepeatedTail(cleaned);
}

export function compactForMatching(text: string) {
  return normalizeSpecText(text).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeExtractedTitle(title: string) {
  return cleanEvidenceText(title)
    .replace(/\bToiletroll\b/gi, "Toilet roll")
    .replace(/\s+([:/&-])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cleanEvidenceText(cell))
    .filter(Boolean);
}

export function isSeparatorRow(line: string) {
  return /^\|?[\s|:-]+\|?$/.test(line.trim());
}

export function dedupeCells(cells: string[]) {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const cell of cells) {
    const key = compactForMatching(cell);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(cell);
  }

  return unique;
}

export function hasRepeatedCells(cells: string[]) {
  if (cells.length < 2) {
    return false;
  }

  const compacted = cells.map((cell) => compactForMatching(cell));
  return compacted.every((cell) => cell === compacted[0]);
}

export function isLowInformationEvidence(text: string) {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  return words.length <= 6 && new Set(words).size <= 2;
}

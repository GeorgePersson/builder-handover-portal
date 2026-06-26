const ocrPhraseFixes: Array<[RegExp, string]> = [
  [/\bTopographical\b/gi, "Topographical"],
  [/\bto\s+pographical\b/gi, "topographical"],
  [/\bstand\s+ard\b/gi, "standard"],
  [/\bstand\s+ing\b/gi, "standing"],
  [/\brein\s*for\s*ced\b/gi, "reinforced"],
  [/\bupst\s+and\b/gi, "upstand"],
  [/\bthere\s+fore\b/gi, "therefore"],
  [/\bavailable\s*as\s*an\s*extra\s*cost\s*upgrade\b/gi, "available as an extra cost upgrade"],
  [/\bavailableasan\s*extracostupgrade\b/gi, "available as an extra cost upgrade"],
  [/\bCus\s+tom\b/gi, "Custom"],
  [/\bCus\s+to\s+msize\b/gi, "Custom size"],
  [/\bCustom\s+msize\b/gi, "Custom size"],
  [/\bto\s+msize\b/gi, "tom size"],
  [/\bNeed\s+to\s+check\s+size\b/gi, "Need to check size"],
  [/\bMeasurespecific\b/gi, "Measure specific"],
  [/\bmmsizetbconsiteby\b/gi, "mm size TBC on site by"],
  [/\bWorkor\b/gi, "Work or"],
  [/\bMaterialsitemsthataffect\b/gi, "Materials items that affect"],
  [/\bMaterialsitems\b/gi, "Materials items"],
  [/\bitemsthataffect\b/gi, "items that affect"],
  [/\bissuingofa\b/gi, "issuing of a"],
  [/\bCertificatewillneed\b/gi, "Certificate will need"],
  [/\bwillneed\b/gi, "will need"],
  [/\bbeinspectedby\b/gi, "be inspected by"],
  [/\bproperlysignedoff\b/gi, "properly signed off"],
  [/\bwnerisresponsible\b/gi, "owner is responsible"],
  [/\bsuchinspections\b/gi, "such inspections"],
  [/\bre-inspectioncosts\b/gi, "re-inspection costs"],
  [/\bordocumentationrequired\b/gi, "or documentation required"],
  [/\bdocumentationrequired\b/gi, "documentation required"],
  [/\bswitchesonwhen\b/gi, "switches on when"],
  [/\bnightwalk\b/gi, "night walk"],
  [/\blightfeaturesan\b/gi, "light features an"],
  [/\bmotion\s*sensor\b/gi, "motion sensor"],
  [/\bswitcheson\b/gi, "switches on"],
  [/\bitdetects\b/gi, "it detects"],
  [/\batnight\b/gi, "at night"],
  [/\bwith\s*out\s*disturbing\s*others\b/gi, "without disturbing others"],
  [/\bwith\s*outdisturbing\s*o\s*thers\b/gi, "without disturbing others"],
  [/\bwithoutdisturbing\s*others\b/gi, "without disturbing others"],
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
  [/\bLED\s*Sensor\b/gi, "LED Sensor"],
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
  [/mmgibboard/gi, "mm gibboard"],
  [/gibboardceilings/gi, "gibboard ceilings"],
  [/gibboardceilingsthroughouts?/gi, "gibboard ceilings throughout"],
  [/\bthroughouts\b/gi, "throughout"],
  [/\bsto\s*pped\b/gi, "stopped"],
  [/\bto\s*pped\b/gi, "stopped"],
  [/\bfourcolours\b/gi, "four colours"],
  [/\bcolour(\d+)/gi, "colour $1"],
  [/\bwaterbornesemi-gloss\b/gi, "waterborne semi-gloss"],
  [/\bSemi-glosspaintfinish\b/gi, "Semi-gloss paint finish"],
  [/\bflushpanelpre-hung\s*doors\b/gi, "flush panel pre-hung doors"],
  [/\bAsper\b/gi, "As per"],
  [/\bAsperelectrical\b/gi, "As per electrical"],
  [/\bIsl\s+and\b/gi, "Island"],
  [/\bunderneathoverhead\b/gi, "underneath overhead"],
  [/\bDoors\s+tops\b/gi, "Door stops"],
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
  [/\baccessoriesthatdeliverscleverefficiency\b/gi, "accessories that deliver clever efficiency"],
  [/\bundersideofoverheadcupboardsbreakfastnook\b/gi, "underside of overhead cupboards breakfast nook"],
  [/\bundersideofoverheadcupboards\b/gi, "underside of overhead cupboards"],
  [/\bplash-back\s*from\b/gi, "splashback from"],
  [/\bFrontpanel\b/gi, "Front panel"],
  [/\bbench\s+bench\b/gi, "bench"],
  [/\bcontrac\s*tor\b/gi, "contractor"],
  [/\b(\d+)\s*xwire\b/gi, "$1 x wire"],
  [/\bairconditioning\b/gi, "air conditioning"],
  [/\bamp\s*supply\b/gi, "amp supply"],
  [/\bexteriorofbuildingonly\b/gi, "exterior of building only"],
  [/\bnoallowance\b/gi, "no allowance"],
  [/\bwireorconnect\b/gi, "wire or connect"],
  [/\binstalledby\b/gi, "installed by"],
  [/\bHighpolished\b/gi, "High polished"],
  [/\bgradestainlesssteel\b/gi, "grade stainless steel"],
  [/\b(\d+)\s*xhooksupplied\b/gi, "$1 x hook supplied"],
  [/\bensuitebed\b/gi, "ensuite bed"],
  [/\bconfirmpositions\b/gi, "confirm positions"],
  [/\bFridgepowerpoint\b/gi, "Fridge powerpoint"],
  [/\bMicrowavepowerpoint\b/gi, "Microwave powerpoint"],
  [/\bRangehoodpowerpoint\b/gi, "Rangehood powerpoint"],
  [/\bDishwasherpowerpoint\b/gi, "Dishwasher powerpoint"],
  [/\bWastedisposalpowerpoint\b/gi, "Waste disposal powerpoint"],
  [/\bHotwatercylinderconnection\b/gi, "Hot water cylinder connection"],
  [/\bHotwatercylinder\b/gi, "Hot water cylinder"],
  [/\bRHWhen\b/g, "RH When"],
  [/\bWhenst\s*and\s*ing\b/gi, "When standing"],
  [/\bstand\s*ingfacing\b/gi, "standing facing"],
  [/\blookingat\b/gi, "looking at"],
  [/\boutsideof\b/gi, "outside of"],
  [/\bshelfon\b/gi, "shelf on"],
  [/\bsideonend\b/gi, "side on end"],
  [/\bbemountedonback\b/gi, "be mounted on back"],
  [/\boverlapsbothfixedpanels\b/gi, "overlaps both fixed panels"],
  [/\bfixedpanels\b/gi, "fixed panels"],
  [/\bfixedpanel\b/gi, "fixed panel"],
  [/\bmm-slides\b/gi, "mm - slides"],
  [/\bNB:Slide\b/g, "NB: Slide"],
  [/\bspray-brushedwarmsunset\b/gi, "spray-brushed warm sunset"],
  [/\bsquarelaid\b/gi, "square laid"],
  [/\bflatacrylic\b/gi, "flat acrylic"],
  [/\bmasterensuite\b/gi, "master ensuite"],
  [/\bBuilder\s*srange\b/gi, "Builder's range"],
  [/\bfrom\s*Builder\s*srange\b/gi, "from Builder's range"],
  [/\bLevel\s*2:\s*ihen\b/gi, "Level 2: kitchen"],
  [/\bcullery\b/gi, "scullery"],
  [/\bining\b/gi, "dining"],
  [/\bounge\b/gi, "lounge"],
  [/\baundry\b/gi, "laundry"],
  [/\bnsuitbed\b/gi, "ensuite bed"],
  [/\b(\d+)\s*l\s*mains\s*pressure\s*electric\b/gi, "$1L mains pressure electric"],
  [/\b(\d+)\s*lmainspressureelectric\b/gi, "$1L mains pressure electric"],
  [/\b(\d+)\s*kwelement\b/gi, "$1 kW element"],
  [/\bthe\s+rmostat\b/gi, "thermostat"],
  [/\bthroostat\b/gi, "thermostat"],
  [/\bHotplateconnection\b/gi, "Hotplate connection"],
  [/\bovenconnection\b/gi, "oven connection"],
  [/\bslabonpoly\b/gi, "slab on poly"],
  [/\bthe\s*nedampproof\b/gi, "then damp proof"],
  [/\bcuringcanresultincracksappearing\b/gi, "curing can result in cracks appearing"],
  [/\bThisis\b/gi, "This is"],
  [/\bItdoesnotindicatestructuralfailure\b/gi, "It does not indicate structural failure"],
  [/\bofany\b/gi, "of any"],
  [/\bnotaffect\b/gi, "not affect"],
  [/\bper\s*for\s*manceof\b/gi, "performance of"],
  [/\bElectronicsecuritysystemincluding\b/gi, "Electronic security system including"],
  [/\bardinfraredsensors\b/gi, "ard infrared sensors"],
  [/\bstand\s+ard\s+infrared\b/gi, "standard infrared"],
  [/\baccessoriesthatdelivers\b/gi, "accessories that deliver"],
  [/\bRein\s*for\s*cedconcretefooting\b/gi, "Reinforced concrete footing"],
  [/\bWaterproofmembraneunder\b/gi, "Waterproof membrane under"],
  [/\blaidontimber\b/gi, "laid on timber"],
  [/\binginwetareas\b/gi, "in wet areas"],
  [/\bveneerlaminated\b/gi, "veneer laminated"],
  [/\bastructuralplybase\b/gi, "a structural ply base"],
  [/\bstraightlaid\b/gi, "straight laid"],
  [/\bGaragecarpetgluefixed\b/gi, "Garage carpet glue fixed"],
  [/\bTimekeeperplustimer\b/gi, "Timekeeper Plus timer"],
  [/\bConcealedwiring\b/gi, "Concealed wiring"],
  [/\bgasfireplaceappliance\b/gi, "gas fireplace appliance"],
  [/\bInsinkera\s*to\s*rmultitap\b/gi, "Insinkerator multitap"],
  [/\birresistiblybeautiful\b/gi, "irresistibly beautiful"],
  [/\baccessories\s+that\s+delivers\b/gi, "accessories that deliver"],
  [/\bcleverefficiency\b/gi, "clever efficiency"],
  [/\bWinnerof\b/gi, "Winner of"],
  [/\bPDL\s*Jconic\s+Series\b/gi, "PDL Iconic Series"],
  [/\bJconic\s+Series\b/gi, "Iconic Series"],
  [/\bWhitefaceplates\b/gi, "White faceplates"],
  [/\bPDLIconic\b/gi, "PDL Iconic"],
  [/\blifeeasy\b/gi, "life easy"],
  [/\bVantiy\b/gi, "Vanity"],
  [/\bC\/WSoft\b/gi, "C/W Soft"],
  [/\bclickclackmushroom\b/gi, "clickclack mushroom"],
  [/\bthe\s*lconicrangeisfuture-proofed\b/gi, "the Iconic range is future-proofed"],
  [/\blconicrangeisfuture-proofed\b/gi, "Iconic range is future-proofed"],
  [/\bPDLlconic\s*Series\b/gi, "PDL Iconic Series"],
  [/\bthe\s*lconicrange\b/gi, "the Iconic range"],
  [/\bthe\s*Iconicrange\b/gi, "the Iconic range"],
  [/\blconic\s*range\b/gi, "Iconic range"],
  [/\blconic\s*Series\b/gi, "Iconic Series"],
  [/\bisfuture-proofed\b/gi, "is future-proofed"],
  [/\bsimplesmarthomeconnectivityoptions\b/gi, "simple smart home connectivity options"],
  [/\bsmart\s*home\b/gi, "smart home"],
  [/\bBlue\s+to\s+oth\b/gi, "Bluetooth"],
  [/\bBluetoothconnectivity\b/gi, "Bluetooth connectivity"],
  [/\bUSBcharging\b/gi, "USB charging"],
  [/\btomakelivingamodernconnected\b/gi, "to make living a modern connected"],
  [/\bmakelivingamodernconnected\b/gi, "make living a modern connected"],
  [/\bmodernconnected\b/gi, "modern connected"],
  [/\bnewst\s*and\s*ard\s*in\s*residential\b/gi, "new standard in residential"],
];

export function applyOcrPhraseFixes(text: string) {
  return ocrPhraseFixes.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

const genericOcrSegmentWords = [
  "freestanding",
  "topographical",
  "waterproofing",
  "manufacturer",
  "description",
  "specification",
  "documentation",
  "overhead",
  "underside",
  "cupboards",
  "breakfast",
  "selected",
  "builder",
  "hardware",
  "upgrade",
  "bathroom",
  "kitchen",
  "scullery",
  "laundry",
  "ensuite",
  "bedroom",
  "outside",
  "inside",
  "standing",
  "looking",
  "facing",
  "mounted",
  "mounting",
  "overlaps",
  "overlap",
  "slides",
  "slide",
  "fixed",
  "panel",
  "panels",
  "shower",
  "shelf",
  "door",
  "wall",
  "floor",
  "flooring",
  "waterproof",
  "membrane",
  "tiles",
  "tiled",
  "timber",
  "wet",
  "areas",
  "engineered",
  "veneer",
  "laminated",
  "structural",
  "ply",
  "base",
  "straight",
  "laid",
  "plan",
  "refer",
  "right",
  "left",
  "rear",
  "front",
  "back",
  "side",
  "both",
  "when",
  "from",
  "with",
  "and",
  "for",
  "the",
  "into",
  "onto",
  "under",
  "over",
  "of",
  "to",
  "on",
  "in",
  "at",
  "if",
  "by",
  "as",
  "be",
].sort((a, b) => b.length - a.length);

const genericOcrConnectorWords = new Set(["of", "to", "on", "in", "at", "if", "by", "as", "be", "and", "for", "the", "from", "with", "when", "both", "into", "onto", "under", "over"]);
const genericOcrDomainWords = new Set(["outside", "inside", "standing", "looking", "facing", "mounted", "mounting", "overlaps", "overlap", "slides", "slide", "fixed", "panel", "panels", "shower", "shelf", "door", "wall", "floor", "flooring", "waterproof", "membrane", "tiles", "tiled", "timber", "wet", "areas", "veneer", "laminated", "structural", "ply", "base", "straight", "laid", "plan", "refer", "right", "left", "rear", "front", "back", "side", "bathroom", "kitchen", "scullery", "laundry", "ensuite", "bedroom", "builder", "hardware", "upgrade", "selected"]);
const genericOcrTokenAllowlist = new Set([
  "airconditioning",
  "bathroom",
  "bluetooth",
  "documentation",
  "electrical",
  "engineered",
  "freestanding",
  "manufacturer",
  "performance",
  "specification",
  "thermostat",
  "topographical",
  "waterproofing",
]);

export function splitGenericGluedOcrToken(token: string) {
  if (!/^[a-z]{10,60}$/i.test(token)) return null;
  if (/[0-9]/.test(token)) return null;
  const lower = token.toLowerCase();
  if (genericOcrTokenAllowlist.has(lower)) return null;

  const memo = new Map<string, string[] | null>();
  function segment(rest: string): string[] | null {
    if (!rest) return [];
    if (memo.has(rest)) return memo.get(rest)!;
    for (const word of genericOcrSegmentWords) {
      if (!rest.startsWith(word)) continue;
      const tail = segment(rest.slice(word.length));
      if (tail) {
        const value = [word, ...tail];
        memo.set(rest, value);
        return value;
      }
    }
    memo.set(rest, null);
    return null;
  }

  const parts = segment(lower);
  if (!parts || parts.length < 3) return null;
  const connectorCount = parts.filter((part) => genericOcrConnectorWords.has(part)).length;
  const domainCount = parts.filter((part) => genericOcrDomainWords.has(part)).length;
  if (connectorCount < 1 || domainCount < 2) return null;
  return parts;
}

export function findGenericGluedOcrTokens(text: string) {
  const matches = text.match(/\b[a-z]{10,60}\b/gi) || [];
  return [...new Set(matches.filter((token) => splitGenericGluedOcrToken(token)))];
}

function applyGenericGluedOcrSplits(text: string) {
  return text.replace(/\b[a-z]{10,60}\b/gi, (token) => {
    const parts = splitGenericGluedOcrToken(token);
    return parts ? parts.join(" ") : token;
  });
}

export function normalizeSpecText(text: string) {
  const normalized = applyGenericGluedOcrSplits(applyOcrPhraseFixes(text))
    .replace(/<!--[^>]*-->/g, " ")
    .replace(/→/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/([a-z]{3,})(to|from|with|and|for|the|wall|floor|door|window|shower|bathroom|kitchen|client|builder|hardware|paint|finish|tiles|tiled|selected)/gi, "$1 $2")
    .replace(/(to|from|with|and|for|the|wall|floor|door|window|shower|bathroom|kitchen|client|builder|hardware|paint|finish|tiles|tiled|selected)([a-z]{3,})/gi, "$1 $2")
    .replace(/[\t|]+/g, " ");

  return applyGenericGluedOcrSplits(applyOcrPhraseFixes(normalized)).replace(/\bk\s+W\b/g, "kW").replace(/\s+/g, " ").trim();
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
    .replace(/\bLLM\s*Review\s*(?:Lane|Reason)\s*:\s*.*$/gi, " ")
    .replace(/\bLLMReview(?:Lane|Reason)\s*:\s*.*$/gi, " ")
    .replace(/\bcandidate[_ -]?id\s*:\s*\S+/gi, " ")
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

  return collapseRepeatedTail(cleaned)
    .replace(/\bInsinkera\s+tor\b/gi, "Insinkerator");
}

export function cleanStructuredEvidenceText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (/^(LLMReviewLane|LLMReviewReason|candidate[_ -]?id|Has\s*Identifier|Suggested\s*Search\s*Query):\s*/i.test(line)) return "";
      const match = line.match(/^(Name|Manufacturer\/Supplier|ProductCode|Finish|Size|Category|Location|Description):\s*(.*)$/);
      if (!match) return cleanEvidenceText(line);
      const [, label, value] = match;
      return `${label}: ${cleanEvidenceText(value)}`;
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function hasLikelyDirtyOcrText(text: string) {
  return /\b(?:LLMReviewLane|LLMReviewReason|candidate[_ -]?id|stand\s+ing|stand\s*ingfacing|rein\s+for\s+ced|the\s+rmostat|throostat|\d+\s*l[a-z]{8,}|kwelement|[a-z]{7,}(?:electric|pressure|element|thermostat|connection|powerpoint)|RHWhen|Whenst\s*and\s*ing|lookingat|outsideof|shelfon|sideonend|bemountedonback|overlapsbothfixedpanels|fixedpanels?|mm-slides|NB:Slide|ihen|cullery|ining|ounge|aundry|nsuitbed|[a-z]{8,}(?:of|to|the|with|from|and|for|in|as|by|or|if|no|on|when)[a-z]{4,}|plash-back|Frontpanel|Winnerof|availableasan|switcheson|itdetects|USBcharging|Bluetoothconnectivity|lconicrange|accessoriesthat|undersideofoverhead|overheadcupboardsbreakfastnook|xwire|airconditioning|ampsupply|exteriorofbuildingonly|noallowance|wireorconnect|installedby|contrac\s+tor|gradestainlesssteel|xhooksupplied|ensuitebed|confirmpositions|Fridgepowerpoint|Microwavepowerpoint|Rangehoodpowerpoint|Dishwasherpowerpoint|Wastedisposalpowerpoint|Hotwatercylinderconnection|Hotplateconnection|slabonpoly|curingcanresultincracksappearing|Itdoesnotindicatestructuralfailure|Electronicsecuritysystemincluding|ardinfraredsensors)\b/i.test(text)
    || findGenericGluedOcrTokens(text).length > 0;
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
  const uniqueWords = new Set(words);
  return words.length <= 12 && uniqueWords.size <= 2;
}

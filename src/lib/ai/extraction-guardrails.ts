const ADMIN_NOISE_PATTERNS = [
  /\b(contract|agreement|conditions? of contract|contractor shall|principal|liquidated damages|retention|variation|progress claim)\b/i,
  /\b(payment|deposit|invoice|claim|schedule of rates|provisional sum|prime cost|pc sum|allowance)\b/i,
  /\b(preliminar(?:y|ies)|site establishment|site setup|temporary works?|temporary fencing|portaloo|site office|scaffold(?:ing)?|edge protection|hoarding)\b/i,
  /\b(council|consent authority|building consent|inspection booking|admin(?:istration)?|permit|lodgement|compliance schedule fee)\b/i,
  /\b(insurance|public liability|health and safety|h&s|hazard|induction|swms|site safety|worksafe)\b/i,
  /\b(workmanship|workmanlike|best trade practice|trade standards?|as directed|make good|shop drawings?|setting out)\b/i,
];

const HOMEOWNER_RELEVANT_PATTERNS = [
  /\b(warrant(?:y|ies)|guarantee|manual|owner'?s manual|care guide|maintenance|certificate|producer statement|ps[1234]\b|code compliance|ccc\b)\b/i,
  /\b(appliance|dishwasher|oven|cooktop|rangehood|heat pump|hvac|hot water|tapware|mixer|toilet|vanity|shower|bath|fixture|fitting)\b/i,
  /\b(floor(?:ing)?|carpet|tile|vinyl|timber floor|cladding|weatherboard|roof(?:ing)?|gutter|downpipe|paint|coating|finish|colour|color|stain)\b/i,
  /\b(manufacturer|brand|model|product code|sku|supplier|selection schedule|selections?)\b/i,
];

export function hasHomeownerRelevance(text: string) {
  return HOMEOWNER_RELEVANT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isAdminNoiseText(text: string) {
  return ADMIN_NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

export function shouldExcludeAsAdminNoise(text: string) {
  return isAdminNoiseText(text) && !hasHomeownerRelevance(text);
}

export type ProposedSpecItem = {
  item_type: "product" | "maintenance" | "document";
  title: string;
  category: string;
  location: string;
  extracted_text: string;
  matched_existing_record: string | null;
  confidence_score: number;
  recommended_action:
    | "attach_existing_product"
    | "attach_existing_task"
    | "manual_review"
    | "request_document"
    | "review_new_product";
};

export function getInitialExtractedItemStatus(item: Pick<ProposedSpecItem, "matched_existing_record" | "confidence_score">) {
  if (item.matched_existing_record && item.confidence_score >= 75) {
    return "auto_approved" as const;
  }

  return "admin_review" as const;
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function buildSpecificationProposals(extractedText: string): ProposedSpecItem[] {
  const text = extractedText.toLowerCase();
  const proposals: ProposedSpecItem[] = [];

  if (includesAny(text, ["linea", "weatherboard", "cladding", "james hardie"])) {
    const isKnownLinea = includesAny(text, ["linea", "james hardie"]);

    proposals.push({
      item_type: "product",
      title: isKnownLinea ? "Linea Weatherboard" : "Exterior cladding system",
      category: "Cladding",
      location: "Exterior envelope",
      extracted_text: "Specification references exterior cladding and coating requirements.",
      matched_existing_record: isKnownLinea ? "Linea Weatherboard" : null,
      confidence_score: isKnownLinea ? 90 : 64,
      recommended_action: isKnownLinea ? "attach_existing_product" : "review_new_product",
    });
  }

  if (includesAny(text, ["heat pump", "heating", "cooling", "hvac"])) {
    proposals.push({
      item_type: "product",
      title: "Heat pump system",
      category: "Heating/cooling",
      location: "Services",
      extracted_text: "Specification references heating or cooling equipment; exact model should be confirmed.",
      matched_existing_record: null,
      confidence_score: 62,
      recommended_action: "review_new_product",
    });
  }

  if (includesAny(text, ["gutter", "downpipe", "roof"])) {
    proposals.push({
      item_type: "maintenance",
      title: "Clean gutters and downpipes",
      category: "Maintenance",
      location: "Roof and drainage",
      extracted_text: "Specification references roof drainage components that should be maintained.",
      matched_existing_record: "Clean gutters and downpipes",
      confidence_score: 82,
      recommended_action: "attach_existing_task",
    });
  }

  if (includesAny(text, ["wash", "clean", "maintenance", "cladding"])) {
    proposals.push({
      item_type: "maintenance",
      title: "Wash exterior cladding",
      category: "Maintenance",
      location: "Exterior envelope",
      extracted_text: "Specification suggests exterior surfaces require regular cleaning or maintenance.",
      matched_existing_record: "Wash exterior cladding",
      confidence_score: 86,
      recommended_action: "attach_existing_task",
    });
  }

  if (includesAny(text, ["ccc", "code compliance", "producer statement", "ps3", "ps4"])) {
    const isProducerStatement = includesAny(text, ["producer statement", "ps3", "ps4"]);

    proposals.push({
      item_type: "document",
      title: isProducerStatement ? "Producer statements" : "Code Compliance Certificate",
      category: "Document",
      location: "Handover pack",
      extracted_text: "Specification or checklist references compliance documentation for handover.",
      matched_existing_record: null,
      confidence_score: 74,
      recommended_action: "request_document",
    });
  }

  if (includesAny(text, ["dishwasher", "oven", "cooktop", "rangehood", "appliance"])) {
    proposals.push({
      item_type: "product",
      title: "Kitchen appliances",
      category: "Appliance",
      location: "Kitchen",
      extracted_text: "Specification references kitchen appliances; exact models should be confirmed.",
      matched_existing_record: null,
      confidence_score: 58,
      recommended_action: "review_new_product",
    });
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
      matched_existing_record: null,
      confidence_score: 28,
      recommended_action: "manual_review",
    },
  ];
}

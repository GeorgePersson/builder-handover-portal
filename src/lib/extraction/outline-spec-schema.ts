export const outlineSpecContextClassifications = [
  "known_match_candidate",
  "source_ready_unknown",
  "builder_input_needed",
  "project_document",
  "generic_allowance",
  "admin_or_contract",
  "not_handover_relevant",
] as const;

export type OutlineSpecContextClassification =
  (typeof outlineSpecContextClassifications)[number];

export type OutlineSpecItemName = {
  Name?: string;
  Manufacturer?: string;
  Supplier?: string;
  ProductRange?: string;
  ModelName?: string;
  ProductCode?: string;
  Sku?: string;
  Finish?: string;
  Colour?: string;
  Size?: string;
  Quantity?: string;
  Category?: string;
  Location?: string;
  Description?: string;
  Notes?: string;
  HasIdentifier?: boolean;
  SuggestedSearchQuery?: string;
};

export type OutlineSpecExtractedItem = {
  ItemName: OutlineSpecItemName;
  Evidence?: {
    SourcePage?: string;
    SourceSection?: string;
    SourceSnippet?: string;
    Confidence?: number;
  };
  Review?: {
    ContextClassification?: OutlineSpecContextClassification;
    MissingFields?: string[];
    BuilderQuestions?: string[];
    NeedsBuilderContext?: boolean;
    IsSearchReady?: boolean;
    SourceGapReason?: string;
  };
};

export type OutlineSpecExtraction = {
  SpecificationNumber?: string;
  Address?: string;
  Date?: string;
  Items: OutlineSpecExtractedItem[];
};

function textField(description: string) {
  return {
    type: "string",
    description,
  };
}

export const outlineSpecItemsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    SpecificationNumber: textField("Specification document number and revision."),
    Address: textField("Physical address for the property. Leave empty if unavailable or redacted."),
    Date: textField("Date the specification was issued or last revised."),
    Items: {
      type: "array",
      description:
        "Exhaustive list of distinct homeowner-handover products, fixtures, fittings, appliances, materials, components, project documents, and maintenance-relevant items named in the document. Exclude contract clauses, payment terms, preliminaries, site setup, scaffolding, temporary works, council/admin obligations, insurance/health-and-safety text, and generic trade workmanship requirements unless the row also names a homeowner-relevant product, document, finish, certificate, warranty, manual, or maintenance requirement.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ItemName: {
            type: "object",
            additionalProperties: false,
            description:
              "The extracted item and every identifying/detail field available from the source document.",
            properties: {
              Name: textField("Short human-readable item name."),
              Manufacturer: textField("Manufacturer or primary brand. Leave empty only if absent."),
              Supplier: textField("Supplier, reseller, or sourcing house if distinct from manufacturer."),
              ProductRange: textField("Range, series, collection, or family."),
              ModelName: textField("Full model name or description as written."),
              ProductCode: textField("Manufacturer model, part number, or product code exactly as written."),
              Sku: textField("Supplier SKU or stock code if separate from ProductCode."),
              Finish: textField("Finish or material treatment."),
              Colour: textField("Colour selection where stated separately."),
              Size: textField("Dimensions, size, rating, or capacity as written."),
              Quantity: textField("Quantity supplied or installed as written."),
              Category: textField("Building or trade category inferred from source context."),
              Location: textField("Room, level, or area where installed."),
              Description: textField("Full descriptive source text for the item."),
              Notes: textField("Caveats, TBC/TBA markers, quote references, exclusions, or install notes."),
              HasIdentifier: {
                type: "boolean",
                description:
                  "True when the item has enough brand/supplier/model/code/range evidence for database lookup.",
              },
              SuggestedSearchQuery: textField(
                "A source-search query built from strong identifiers. Leave empty unless search-ready.",
              ),
            },
            required: [
              "Name",
              "Manufacturer",
              "Supplier",
              "ProductRange",
              "ModelName",
              "ProductCode",
              "Sku",
              "Finish",
              "Colour",
              "Size",
              "Quantity",
              "Category",
              "Location",
              "Description",
              "Notes",
              "HasIdentifier",
              "SuggestedSearchQuery",
            ],
          },
          Evidence: {
            type: "object",
            additionalProperties: false,
            description: "Traceability back to the source document.",
            properties: {
              SourcePage: textField("Page number or range if available."),
              SourceSection: textField("Heading, schedule, or table name if available."),
              SourceSnippet: textField("Short verbatim source snippet supporting this item."),
              Confidence: {
                type: "number",
                description: "Extraction confidence from 0 to 100.",
              },
            },
            required: ["SourcePage", "SourceSection", "SourceSnippet", "Confidence"],
          },
          Review: {
            type: "object",
            additionalProperties: false,
            description:
              "Review routing used to prevent unnecessary internet/source search before database matching and builder clarification.",
            properties: {
              ContextClassification: {
                type: "string",
                enum: outlineSpecContextClassifications,
                description: "Routing classification for the item.",
              },
              MissingFields: {
                type: "array",
                items: { type: "string" },
                description: "Fields needed before the item is complete.",
              },
              BuilderQuestions: {
                type: "array",
                items: { type: "string" },
                description: "Plain-language questions to ask the builder.",
              },
              NeedsBuilderContext: {
                type: "boolean",
                description: "True when builder input is needed before source search.",
              },
              IsSearchReady: {
                type: "boolean",
                description: "True only when the item is specific enough for one source search.",
              },
              SourceGapReason: textField("Why the item is not source-ready, if applicable."),
            },
            required: [
              "ContextClassification",
              "MissingFields",
              "BuilderQuestions",
              "NeedsBuilderContext",
              "IsSearchReady",
              "SourceGapReason",
            ],
          },
        },
        required: ["ItemName", "Evidence", "Review"],
      },
    },
  },
  required: ["SpecificationNumber", "Address", "Date", "Items"],
} as const;

export function getStrongestIdentity(item: OutlineSpecItemName) {
  return [
    item.Manufacturer,
    item.ProductCode,
    item.ModelName,
    item.ProductRange,
    item.Supplier,
    item.Finish,
    item.Colour,
    item.Size,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

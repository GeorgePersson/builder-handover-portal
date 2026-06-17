# AI Product Draft Contract

Endpoint: `POST /api/ai/product-draft`

This route is intentionally provider-neutral for now. It validates the product
lookup request, runs the same deterministic source-enrichment scaffold used by
admin global approval, and returns the strict JSON shape the builder review UI
will eventually save to `product_versions`, `product_sources`, and audit logs.

## Request

```json
{
  "productName": "Linea Weatherboard",
  "brand": "James Hardie",
  "category": "Cladding",
  "model": "",
  "supplierUrl": "",
  "region": "New Zealand"
}
```

## Response Shape

```json
{
  "product_identity": {
    "canonical_name": "",
    "brand": "",
    "manufacturer": "",
    "category": "",
    "model": "",
    "region": "New Zealand",
    "identity_confidence": 0
  },
  "sources": [],
  "warranty": {
    "period": "",
    "start_condition": "",
    "exclusions": "",
    "void_conditions": "",
    "source_url": ""
  },
  "maintenance": {
    "requirements": "",
    "frequency": "",
    "cleaning_instructions": "",
    "inspection_requirements": "",
    "source_url": ""
  },
  "special_conditions": {
    "coastal_exposure": "",
    "paint_or_coating": "",
    "installer_requirements": "",
    "owner_responsibilities": ""
  },
  "confidence": {
    "score": 0,
    "label": "low",
    "reasons": [],
    "missing_fields": [],
    "conflicts": [],
    "recommended_status": "needs_review"
  }
}
```

## Next Implementation Step

Replace the deterministic enrichment scaffold with an AI research service that:

- Searches official manufacturer, warranty, care, installation, NZ distributor,
  and BRANZ/appraisal sources in that order.
- Extracts warranty and maintenance claims with source URLs for each claim.
- Runs a critic pass for product identity, conflicts, missing fields, and NZ
  relevance.
- Saves source URLs and source document hashes before a product is approved.

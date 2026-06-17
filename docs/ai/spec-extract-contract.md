# Specification Extraction Contract

Endpoint: `POST /api/ai/spec-extract`

This is the point-of-difference workflow:

1. Builder uploads a project specification PDF.
2. System extracts text/tables from the PDF.
3. AI identifies handover package items:
   - products/materials
   - documents/certificates/manuals/warranties
   - maintenance tasks
4. System matches extracted items to existing product library records where safe.
5. Builder reviews proposed additions.
6. Accepted items are attached to the handover package.

## Request

```json
{
  "projectId": "project-id",
  "specificationId": "specification-upload-id",
  "fileName": "Project specification.pdf",
  "extractedText": "Optional pre-parsed text from PDF"
}
```

## Response

```json
{
  "specification": {
    "id": "",
    "file_name": "",
    "extraction_status": "needs_review"
  },
  "summary": {
    "extracted_count": 0,
    "matched_existing_count": 0,
    "new_item_count": 0,
    "blocked_count": 0,
    "notes": []
  },
  "proposed_items": [
    {
      "item_type": "product",
      "title": "",
      "category": "",
      "location": "",
      "extracted_text": "",
      "matched_existing_record": null,
      "confidence_score": 0,
      "recommended_action": "review_new_product"
    }
  ]
}
```

## Later Implementation

- Parse PDFs server-side before invoking AI.
- Chunk long specifications by section.
- Extract product schedules, finish schedules, appliance schedules, document
  checklist items, and maintenance notes.
- Match against the product library using brand/model/category/location.
- Create `extracted_handover_items` rows for review.
- On accept, create or attach product versions, documents, and maintenance tasks.

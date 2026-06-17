# Specification PDF Intake Workflow

This is the product direction that can move the portal beyond smaller builders:
the builder uploads one specification PDF, then AI proposes a handover package.

## Builder Flow

1. Builder creates or selects a project.
2. Builder uploads the project specification PDF.
3. System stores the PDF in private storage and creates a `specification_uploads`
   record.
4. PDF text/tables are extracted.
5. AI identifies proposed handover items:
   - products/materials
   - required documents/manuals/warranties
   - maintenance tasks
6. System matches extracted products/tasks against existing library records.
7. Builder reviews the generated package.
8. Builder accepts, edits, or rejects each item.
9. Accepted items are attached to the project handover package.

## Why It Matters

Small builders can still add items manually, but mainstream builders often
already have specification documents. Turning that PDF into a reviewed handover
package makes the portal feel much faster and more differentiated.

## Implementation Pieces In App

- `/builder/specifications`
- `/builder/specifications/new`
- `/builder/specifications/review`
- `POST /api/ai/spec-extract`
- `POST /api/specifications/extract-pdf`
- `POST /api/specifications/save-extraction`
- `specification_uploads` table
- `extracted_handover_items` table
- Accept/reject server actions for extracted items
- Local PDF parser using `pdf-parse` for preview extraction
- PDF extraction now preserves page text, normalizes table-like text, detects
  grid-based tables where possible, chunks long extracted content for future AI
  processing, and returns diagnostics/warnings to the upload UI.
- Local scaffold persistence in `.local-data/specification-extractions.json`
- Handover package preview from accepted extracted items at
  `/builder/handover-package`

## Next Engineering Step

Connect real PDF upload and parsing:

1. Upload PDF to Supabase Storage. The scaffold now validates PDFs and saves
   local uploads when Supabase is not configured.
2. Extract text/tables server-side. The scaffold now parses PDF text and
   detected tables locally via `POST /api/specifications/extract-pdf`.
3. Chunk long specifications by section. The PDF extraction helper now prepares
   chunk metadata for future provider-backed AI calls.
4. Send chunks to AI extractor. The local extractor already responds to supplied
   text and shows package proposals in the upload flow.
5. Save proposed items to `extracted_handover_items`. The scaffold already saves
   preview proposals to the local/Supabase review queue.
6. Extend accept/edit/reject actions so accepted items create products,
   document requests, and maintenance tasks.
7. Publish accepted package items to the homeowner portal.

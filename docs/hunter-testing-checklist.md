# Builder Handover Portal Testing Checklist

Use this when you are back on desktop and want to check the upload, AI, review,
publish, and homeowner flows.

## Setup

1. Run the app locally.
   - Command: `npm.cmd run dev`
   - Expected: App opens at `http://127.0.0.1:3000`.

2. Apply the latest Supabase migrations if testing against Supabase.
   - Run `docs/supabase-add-document-workflow-phase1.sql`.
   - Run `docs/supabase-add-handover-approvals.sql`.
   - Expected: Tables include `uploaded_documents`, `document_extraction_jobs`,
     `extracted_items`, `product_matches`, `item_review_actions`,
     `handover_items`, `handover_approvals`, and `audit_logs`.

3. Sign in as the builder test account.
   - Expected: `/builder/projects` loads and shows your projects.

4. Use the demo upload file for the first clean run.
   - File: `docs/demo-assets/bayview-demo-spec.csv`
   - Expected: This gives a predictable upload containing cladding, bathroom
     ventilation, kitchen oven, roofing document, and garage door maintenance
     examples.

## Document Upload And Extraction

1. Upload a valid project document.
   - Open `/builder/projects`.
   - Edit a project.
   - Upload `docs/demo-assets/bayview-demo-spec.csv`, or another PDF, image,
     Word, Excel, or CSV file in Client documents.
   - Expected: The project modal shows the uploaded document, processing status,
     an extraction job, and extracted workflow items.

2. Upload an invalid file type.
   - Try uploading a `.zip` or `.exe`.
   - Expected: Upload is rejected with an unsupported file type error.

3. Test a failed extraction.
   - Upload a supported file whose filename includes `fail-extraction`.
   - Expected: Extraction job shows Failed, retry is available, and publishing is blocked.

4. Retry a failed extraction.
   - Click Retry extraction on the failed job.
   - Expected: Retry count increases. If the filename still includes
     `fail-extraction`, it should keep failing by design.

## Product Matching

1. Test known product matching.
   - Upload a document mentioning `Linea Weatherboard` or `James Hardie`.
   - Expected: Extracted item shows a verified or reviewable local product match
     with confidence and match reason.

2. Test unmatched product handling.
   - Upload a document with a vague product like `unknown bathroom fitting`.
   - Expected: Item becomes `unmatched`, `low_confidence`, or `needs_review`;
     it does not appear in the homeowner portal.

## Builder Review Queue

1. Approve an unresolved item.
   - Open Builder review queue inside the project modal.
   - Click Approve.
   - Expected: Item becomes `approved`, a review action is stored, and it drops
     out of the unresolved queue.

2. Edit an unresolved item.
   - Expand Edit extracted details.
   - Change name/category/warranty/maintenance text.
   - Save edited item.
   - Expected: Item becomes `edited_by_builder`, edited values remain after refresh,
     and source/audit history is preserved.

3. Mark builder-supplied.
   - Click Builder supplied.
   - Expected: Item becomes `builder_supplied`, approval metadata is stored, and
     it is eligible for the handover.

4. Exclude an item.
   - Enter an exclusion reason and submit.
   - Expected: Item becomes `excluded`, exclusion reason is stored, and it never
     appears in the homeowner handover.

5. Attach supporting evidence.
   - Upload a supporting document from the review queue.
   - Expected: `item_review_actions` records `supporting_document_uploaded`, but
     the item remains unresolved until approved/edited/excluded/builder-supplied.

## Publish Blocking

1. Try publishing while processing is incomplete.
   - Upload a document, then open Send package before extraction is complete.
   - Expected: UI shows a publish blocker and backend rejects direct publish with
     `workflow-publish-blocked`.

2. Try publishing with failed extraction.
   - Use a failed extraction job.
   - Expected: UI shows failed extraction blocker and backend rejects publish.

3. Try publishing with unresolved review items.
   - Leave one item as `needs_review`, `low_confidence`, or `unmatched`.
   - Expected: UI shows unresolved review blocker and backend rejects publish.

4. Publish after all blockers are resolved.
   - Complete/retry failed jobs and resolve all review items.
   - Expected: Publish button is enabled once there is at least one approved item
     and no blockers remain.

## Final Approval

1. Check required builder approval.
   - Open Send package.
   - Try to publish without ticking the builder approval checkbox.
   - Expected: Browser blocks normal submit; backend rejects tampered submit with
     `handover-approval-required`.

2. Check required AI approval.
   - Use a project with AI/workflow/spec-extracted items.
   - Try to publish without ticking the AI confirmation checkbox.
   - Expected: Backend rejects tampered submit with `handover-ai-approval-required`.

3. Check approval record storage.
   - Publish with all required checkboxes ticked.
   - Expected: `handover_approvals` or `.local-data/uploaded-documents.json`
     stores approver, timestamp, handover version, checkbox text, included item
     IDs, excluded item IDs, AI item count, and reviewed item count.

## Homeowner Portal

1. Confirm homeowner visibility before publish.
   - Approve workflow items but do not publish.
   - Open `/client/portal`.
   - Expected: Homeowner cannot see unpublished generated workflow handover items.

2. Confirm homeowner visibility after publish.
   - Publish the project.
   - Open `/client/portal`.
   - Expected: Homeowner sees only approved `handover_items`, visible documents,
     maintenance tasks, and published handover package details.

3. Confirm hidden data stays hidden.
   - Check homeowner portal after publishing.
   - Expected: Raw AI JSON, unresolved items, excluded items, exclusion reasons,
     and low-confidence unapproved data are not visible.

4. Edit after publish.
   - After publishing, edit or approve another workflow item.
   - Open homeowner portal before republishing.
   - Expected: Published homeowner data does not silently change until the
     builder runs the final publish/approval flow again.

## Permission Checks

1. Tamper project upload.
   - With Supabase enabled, change a hidden `projectId` to another organisation's project.
   - Expected: Upload is rejected with `project-not-found`.

2. Tamper review item ID.
   - Change an item review form `itemId` to another organisation's extracted item.
   - Expected: Action is rejected and no review/action/audit rows are created for
     the other organisation.

3. Try raw storage URL access.
   - Open a Supabase Storage object URL while signed out.
   - Expected: Private bucket files are not publicly accessible.

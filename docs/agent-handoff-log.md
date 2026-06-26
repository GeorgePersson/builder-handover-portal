# Agent Handoff Log

## 2026-06-26 - Phased Work Cleaned Up Into Remaining Work Roadmap

### Trigger

User asked to complete the phased work document, remove parts already done from the active work list, and provide context where work is not complete.

### Changes

- `docs/phased-work.md`
  - Rewrote the file as a current/future roadmap instead of a mixed history list.
  - Kept completed work only as concise context under each phase so future agents do not repeat it.
  - Moved remaining actionable work into explicit numbered lists for each phase.
  - Kept `/builder/projects` hardening as the active slice and pointed to `docs/builder-project-workspace-ui-contract.md` as the regression source of truth.
  - Preserved context for unfinished areas: browser/visual test hardening, fresh Docling upload smoke, manual checklist completion states, quote linking, per-section document completion, client-safe output, audit consistency, and Cloudflare/OpenNext production hardening.

### Verification

- To run after this handoff entry: `npm.cmd run lint` and `npm.cmd run build`.

## 2026-06-26 - Project Workspace Next Steps Added To Phased Work

### Trigger

User asked to make a list of the next steps and add them into the phased work document.

### Changes

- `docs/phased-work.md`
  - Added `Immediate Next Steps - Project Workspace Hardening` near the top of the stable phase-routing document.
  - Pointed future agents to `docs/builder-project-workspace-ui-contract.md` as the `/builder/projects` UI source of truth.
  - Captured next work for Playwright/browser smoke coverage, visual regression snapshots, demo browser smoke, React/Next server-action upload-form warning guardrails, separate Docling/Turbopack NFT warning hardening, systemic extraction fixture discipline, and lint/build verification.
  - Updated Phase 1 current state to describe the standalone project workspace, dashboard `?projectId=...` deep links, module filters, sidebar client access/status, database-autofill/manual item flow, and documents/legal upload.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from the existing document-context/Docling import path.

## 2026-06-26 - Project Details + Add Document Side-by-Side Regression Fix

### Trigger

User reported a regression in `/builder/projects`: Project details and Add client document were stacked vertically, leaving the top card too tall. User wanted Add client document moved next to Project details because both are short admin sections.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Changed the top project/admin card wrapper from a vertical stack to a responsive two-column grid on wide screens.
  - Project details remains the larger left panel.
  - Add client document sits in the smaller right panel.
  - Kept the upload server-action form free of explicit `encType`/`method` so the React/Next warning stays fixed.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from the existing document-context/Docling import path.

## 2026-06-26 - Checklist Groups + Vertical Entry Boxes Screenshot Fix

### Trigger

User repeated that `/builder/projects` still had unused side space, still used side-by-side columns for data entry, and asked to rename the checklist section to `Handover Items & Products` with clickable group/category headers such as Exterior/Interior.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Reduced outer page gutters and narrowed the read-only right sidebar so the editable content area uses more horizontal space.
  - Converted Project details, Add client document, Add handover item, and expanded item edit forms from side-by-side field grids into stacked vertical entry boxes.
  - Renamed the checklist section heading to `Handover Items & Products`.
  - Added prominent clickable group/category filter buttons above the checklist list:
    - `All items` button clears the category filter.
    - Each actual checklist category becomes a clickable filter button.
    - Category buttons show ready/total counts.
  - Kept text search, status, missing-section, source, and completion-state filters as secondary filters below the group buttons.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from the existing document-context/Docling import path.

### Remaining Work / Recommendation

- Browser-refresh `/builder/projects`, open a project, and verify the checklist now uses the requested title and group chips.
- If the page still visually leaves too much dead space at the far sides, the next pass should inspect the app shell/sidebar widths in-browser and consider reducing the persistent left navigation width or making it collapsible.

## 2026-06-26 - Dashboard Row Deep Links + Server Action File Form Warning Fix

### Trigger

User asked for every row under dashboard panels to be clickable and reported a runtime console error when opening a project/saving a document: React/Next warned that a server-action form cannot specify `encType`/`method` because React supplies those automatically.

### Changes

- `src/app/builder/page.tsx`
  - Active project rows link to `/builder/projects?projectId=<id>`.
  - Client request rows link to the related project workspace.
  - Package rows link to the related project workspace.
  - Upcoming maintenance rows link to `/builder/maintenance#project-<id>`.
  - Dashboard `Row` now accepts optional `href` and renders as a full-row `Link` when present.
- `src/app/builder/projects/page.tsx`
  - Passes `searchParams.projectId` to `ProjectsWorkspace`.
- `src/components/builder/projects-workspace.tsx`
  - Adds `initialProjectId` prop and initializes selected project from it when valid.
  - Removed explicit `encType="multipart/form-data"` from the `createDocumentAction` server-action form. React/Next server actions provide the correct form encoding automatically; specifying it caused the console warning.
- `src/app/builder/maintenance/page.tsx`
  - Added project-card anchors for dashboard maintenance deep links.

### Validation

- `npm.cmd run lint` passed before this handoff entry.
- `npm.cmd run build` passed before this handoff entry; only known Docling/Turbopack NFT tracing warnings appeared.
- Browser smoke attempt reached local dev auth redirect, so authenticated runtime click verification was blocked by login state in the browser session.

## 2026-06-26 - Builder Dashboard Client Requests Panel

### Trigger

User asked to remove the dashboard Admin review metric and Admin review notifications panel, replacing the panel with Client requests.

### Changes

- `src/app/builder/page.tsx`
  - Removed the `Admin review` top metric.
  - Removed `Admin review notifications` panel and the extracted-item admin-review queue references from the builder dashboard.
  - Added/kept `Client requests` as a top metric.
  - Added a `Client requests` dashboard panel showing waiting client requests with title, details/location fallback, and status.
  - Updated dashboard description to focus on active projects, ready packages, client requests, and maintenance follow-up.

## 2026-06-26 - Hide Product Library Nav + Database Fill Direction

### Trigger

User asked to remove the Product Library section and asked whether Codex or ChatGPT/GPT-5.5 could help start filling the database.

### Changes

- `src/components/layout/app-sidebar.tsx`
  - Removed the visible builder sidebar `Product Library` nav item.
  - Kept `/builder/products` and underlying product/autofill database functionality in place so add-item autofill and future admin/database workflows are not broken.

### Database direction

- Use Codex for implementation work: importer scripts, admin review queues, dedupe/matching, schema migrations, fixtures, and tests.
- Use GPT/ChatGPT-style models for source-backed extraction and normalization only: parse manufacturer PDFs, supplier CSVs, invoices, manuals, spec sheets, and uploaded docs into structured candidate rows with evidence.
- Do not seed the database with hallucinated product catalogue rows. Every database row should carry source evidence, confidence, and review status.
- Best first pipeline: manual item entries + uploaded handover docs/spec sheets -> candidate product records -> dedupe/normalize -> builder/admin review -> approved database rows.

## 2026-06-26 - GitHub PR Cleanup

### Trigger

User said the GitHub project was messy and asked for cleanup.

### Actions

- Created one consolidated open PR:
  - #16 `feature/manual-entry-autofill-flow` -> `main`
  - https://github.com/GeorgePersson/builder-handover-portal/pull/16
- Closed stale stacked Codex PRs #1-#15 as superseded by PR #16.
- Deleted remote branches that were fully contained in the consolidated branch:
  - `codex/builder-handover-portal`
  - `codex/docling-local-context`
  - `codex/llamacloud-greenfield`
  - `spike/unstructured-document-context`
- Left remaining unmerged old Codex remote branches intact so no unmerged work is destroyed.

### Result

- GitHub open PR list now has one PR: #16.
- Remaining noisy branch refs are archival/unmerged Codex branches; safe to review/delete later if the user wants a harder branch purge.

## 2026-06-26 - GitHub Branch Push Handoff

### Trigger

User asked to push the current branch and any branches waiting on GitHub because the last push was four days ago.

### Pushes

- Committed current workspace on `feature/manual-entry-autofill-flow`:
  - `d8f3b40 feat: add manual handover item workflow`
- Pushed new remote branch:
  - `origin/feature/manual-entry-autofill-flow`
- Pushed new remote branch:
  - `origin/spike/unstructured-document-context`
- Confirmed existing branches were already up to date on origin:
  - `origin/codex/builder-handover-portal`
  - `origin/codex/docling-local-context`
  - `origin/codex/llamacloud-greenfield`

### Notes

- Local-only `.codex/` and `.hermes/` folders were intentionally left untracked and not pushed.
- This entry is the post-push handoff note and will be committed/pushed as a docs-only follow-up.

## 2026-06-26 - Remove Redundant Add Item Mode Toggle

### Trigger

User said the Add handover item modal did not need the Manual/Search toggle because the existing form already supports both manual item entry and database autofill suggestions in one flow. User also asked to be told in the future when a proposed split is already covered by one combined control.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Removed `entryMode` state and the Search database / Manual add segmented switch from `AddHandoverItemForm`.
  - Kept the automatic database suggestions triggered by the item title.
  - Kept manual add behavior by allowing the same form to submit without choosing a database suggestion.
  - Updated helper copy to explain the combined flow: type details, suggestions appear automatically, choose one for autofill or continue manually.
  - Simplified the submit label to `Add item` unless a database suggestion is selected.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from existing document-context/Docling imports.

## 2026-06-26 - Project Items Priority + Add Item Mode Toggle

### Trigger

User clarified they liked the current project workspace approach and asked to move the item list above the Spec sheet automation coming-soon section, add a Search database / Manual add switch, and remove the Project browser + Add item buttons from the top header.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Moved `ProjectHandoverChecklistSection` above `SpecAutomationComingSoon` so real handover items appear before the future automation placeholder.
  - Removed the top-header `Project browser` and `Add item` action buttons from the project overview action cluster.
  - Kept the left `← Back to projects` link and the Add handover item CTA inside the checklist section.
  - Added an in-modal segmented switch between `Search database` and `Manual add` in `AddHandoverItemForm`.
  - Database mode shows product suggestions when the title matches; manual mode hides suggestions and clears any selected product.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from existing document-context/Docling imports.

## 2026-06-26 - Client Document File Picker Simplification

### Trigger

User asked to remove the visible `Show to client` checkbox from the embedded client document module and make the document form only title, type, and a file button, with title/type side-by-side and the file picker full width beneath them.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Removed the visible show-to-client checkbox from the Add client document UI.
  - Kept `visibleToClient` as a hidden default-on form field so saved handover documents still appear in the client pack.
  - Replaced the path/reference text field with a required `documentFile` file input that opens the OS file picker.
  - Added `encType="multipart/form-data"` to the document form.
  - Layout is now `Title` + `Type` on the top row and one full-width `File` control below.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from existing document-context/Docling imports.

## 2026-06-26 - Project Details Card Document Module Merge

### Trigger

User pointed at unused space inside the project details module and asked to add the document adding module into that same box, while condensing the layout further so more information fits.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Replaced the standalone project-details card plus separate client-documents card with one shared compact module.
  - Project details now sit on the left in a tighter two-column field grid with a small inline Save action.
  - Add client document now sits on the right side of the same module, using the previously empty space.
  - Document add fields were condensed to document name, type, path/reference, show-to-client, and a compact Save action.
  - Removed the old warning block from the document add form to keep the module shorter.

### Verification

- Initial lint/build caught a JSX closing mismatch after moving the card boundary; fixed it.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from existing document-context/Docling imports.

## 2026-06-26 - Project Workspace Compact Density Pass

### Trigger

User said the project workspace still felt too big and asked to “zoom out a bit” so more items fit on one page.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Reduced main page padding and base text size on the projects workspace.
  - Tightened project browser cards, workspace header, metric tiles, buttons, tabs, filters, sidebar cards, document/maintenance cards, checklist cards, and checklist edit forms.
  - Narrowed the right sidebar slightly so the item/checklist area has more horizontal room.
  - Changed the checklist filters to fit more controls across wide screens.
  - Preserved manual item entry, product database autofill, client access, documents, maintenance, send package, and the spec-automation-coming-soon subsection.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from existing document-context/Docling imports.

## 2026-06-26 - Manual Demo Branch De-AI Project Workspace

### Trigger

User asked, in this branch only, to remove visible AI spec sheet checking / builder review UI and replace it with one subsection that says spec sheet automation is coming soon.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Removed visible project-workspace surfaces for AI/spec checking, extraction processing, workflow review queues, builder/admin review lanes, and AI approval checks.
  - Added a single `Spec sheet automation` coming-soon subsection and nav anchor.
  - Simplified package sending to checklist/manual items only.
  - Kept manual item entry, database autofill, client access, documents, maintenance, and send package wired.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from existing document-context/Docling imports.

## 2026-06-26 - Project Workspace Modalized Client Access + Add Item

### Trigger

User said the project page was still too much to read/take in and asked to move client access to the right bar/header modal and make Add items its own modal.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Added modal modes for `clientAccess` and `addItem`.
  - Moved the long Add handover item form out of the main checklist section into an `Add item` modal opened from the workspace header and checklist CTA.
  - Preserved existing manual entry/database-autofill behavior, hidden selected product metadata, and server action wiring.
  - Moved client invite/link/revoke controls out of the main page into a `Client access` modal opened from the workspace header.
  - Added a compact read-only `Client access` card to the right sidebar with invite/open status and a `Manage` button.
  - Removed the unused Paper trail anchor from the workspace nav because client access is no longer an inline section.
  - Main checklist section now focuses on metrics, filters, and item cards, reducing visual overload.

### Verification

- Initial lint/build caught JSX and type issues after the extraction; fixed them.
- Final `npm.cmd run lint` passed.
- Final `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from the existing document-context/Docling import path.

### Remaining Work / Recommendation

- Browser-smoke `/builder/projects`: open a project, click `Add item`, test database suggestion autofill, close/reopen, click `Client access`, and confirm the page feels less dense.

## 2026-06-26 - Project Workspace Width + Vertical Edit Boxes

### Trigger

User shared screenshots showing wide unused gutters around the workspace and a cramped side-by-side editable area. They asked to use the side space better and make the editable information areas vertical boxes instead of columns.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Changed the top-level workspace container from centered `max-w-6xl` to full available width (`w-full max-w-none`) so the project header/workspace expands across the content area instead of leaving large grey gutters.
  - Kept the right read-only status column, but widened it slightly for desktop (`24rem` / `26rem`) so its status cards breathe.
  - Changed the editable overview area from a nested side-by-side column grid into stacked vertical cards.
  - Project details are now a full-width vertical form instead of two columns.
  - Optional spec/import, client access, client document entry, and product lookup now stack underneath as separate vertical boxes.
  - Client document fields also stack vertically instead of splitting into columns.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from the existing document-context/Docling import path.

### Remaining Work / Recommendation

- Browser-smoke the workspace at `/builder/projects` and tune spacing once the user confirms whether they want the right status column retained or moved below the editable boxes.

## 2026-06-26 - Project Workspace Right Sidebar Fill-Out

### Trigger

User asked to fill out the standalone project page better by adding a right-side column for information that does not need editing, including to-be-completed work, legally/commonly required documents to upload, and item categories with counts.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Added a sticky right-side `ProjectWorkspaceSidebar` to the standalone project workspace.
  - The main editable workflow remains on the left; the right column is read-only project guidance/status.
  - Sidebar sections added:
    - `To be completed`: incomplete items, autofill/review checks, missing manuals, missing warranties, missing compliance docs.
    - `Documents to upload / confirm`: Code Compliance Certificate/consent, product warranties, manuals/care guides, producer statements/inspection records, photos/supporting evidence. Copy labels these as common NZ handover/legal pack checks and explicitly says it is not legal advice.
    - `Item categories`: category counts with ready/total values.
    - Demo-path reminder that manual entry plus database autofill is the reliable branch path while spec extraction remains optional/future-facing.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from the existing document-context/Docling import path.

### Remaining Work / Recommendation

- Browser-smoke the visual result at `/builder/projects`: open a project workspace and confirm the right column gives useful status without making the page feel cramped.
- If it feels too dense, the next polish pass should collapse the document checklist into compact rows or make the right column accordion-based on smaller screens.

## 2026-06-26 - Project Workspace Standalone Page Rework

### Trigger

User said the project page felt split weirdly and asked to make project opening feel like its own standalone page, closer to the captured project workspace UI rework direction.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - Changed `/builder/projects` from an edit-modal driven experience to a project browser plus standalone project workspace on the same route.
  - Initial page now shows the project browser and high-level metrics instead of auto-opening the first project.
  - Clicking a project row/card or `Open workspace` opens a dedicated project workspace view inline, with a clear `Back to projects` action.
  - Added a polished standalone project header with project name, address, client/type/handover date, status pill, send-package action, and summary counters.
  - Added top navigation anchors matching the UI rework concept: Overview, Items, Spec upload / review, Documents, and Paper trail.
  - Kept the existing manual checklist/autofill, optional spec/import, document, client access, package-ready, review-lane, and send-package functionality wired.
  - Removed the now-unused edit modal path; create/help/send still use modals.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from the existing document-context/Docling import path.

### Remaining Work / Recommendation

- Browser-smoke the new project browser/workspace interaction on the running dev server: open `/builder/projects`, click `Open workspace`, verify the standalone header and anchors feel right, then test add/edit manual item, send package, and back-to-projects.
- A future polish pass can turn the anchor navigation into true sticky tabs that hide/show only the selected section, but this pass removes the modal/split feeling while preserving all existing functionality.

## 2026-06-26 - Manual Entry + Database Autofill Demo Flow

### Trigger

User asked for a new branch `feature/manual-entry-autofill-flow` that keeps AI/spec extraction in the codebase long term, but makes manual item entry plus approved product database autofill the primary sales/demo path now.

### Branch / Scope

- Created and switched to `feature/manual-entry-autofill-flow`.
- Important caveat: the branch was created from an already dirty worktree containing many prior Docling/extraction/checklist changes. Future staging should be deliberate and file-specific.
- AI/spec extraction routes and code remain in place. Spec upload/import is de-emphasised as optional/secondary rather than removed.

### Changes

- `src/components/builder/projects-workspace.tsx`
  - `/builder/projects` now foregrounds a manual project checklist section.
  - Added an Add handover item flow with approved product database suggestions from loaded `ProductVersion` records.
  - Selecting a suggestion autofills known identity/source fields plus care/manual/warranty/source notes, but copy explicitly says autofill is not authoritative and must be reviewed.
  - Added checklist filters for text search, status, category, missing section, source (`manual`, `database_autofill`, `imported`), and review state.
  - Expanded item cards with source badges, location/quantity/finish/colour metadata, section status pills, not-enough-identity messaging, and database-autofill review warning.
  - Added a detail/edit panel covering identity/name, category, location, manufacturer/brand, model/SKU/product code, supplier/SKU, quantity/finish/colour, care instructions, manual link/reference, warranty, invoice/purchase info, Code of Compliance/compliance docs, supporting documents/photos notes, builder notes, section statuses, and accepted-incomplete reason/audit notes.
  - Updated the package send panel to count and preview manual checklist items that are complete or accepted incomplete.
  - Spec upload copy is now `Optional spec/import path`.
- `src/lib/server/actions.ts`
  - Checklist create/update form parsing now records manual vs `database_autofill` sources, selected product ID/label, autofill-needs-review metadata, location/quantity/finish/colour/supporting-doc notes, accepted-incomplete notes, and explicit section status fields.
- `src/lib/server/queries.ts`
  - Added checklist item -> homeowner-safe package item mapping.
  - Handover package preview now prefers reviewed/accepted checklist items before workflow/extraction items.
  - Published client package preview now includes reviewed/accepted checklist items when the project is published.
- `src/app/builder/handover-package/page.tsx`
  - Copy now describes manual checklist/database-autofill package preview rather than extraction-first package output.
- `src/app/client/portal/page.tsx`
  - Client output labels no longer say `From Spec`; client portal remains clean/homeowner-safe.
- `WORKSHEET.md`
  - Updated with branch, scope, verification, and next-work notes.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
- Build still reports known Docling/Turbopack NFT tracing warnings from the existing Docling/document-context import path.
- A dev server was started briefly but produced no captured logs before being stopped; no browser smoke was completed in this pass.

### Remaining Work / Recommendation

1. Run a browser smoke for the manual branch:
   - open `/builder/projects`;
   - add one manual item without a database match;
   - add one item from an approved database suggestion;
   - edit all sections/statuses;
   - mark one item complete or accepted incomplete with a reason;
   - open `/builder/handover-package`;
   - publish if appropriate;
   - confirm `/client/portal` shows only homeowner-safe reviewed data.
2. Before committing, inspect and stage carefully because the worktree includes many pre-existing extraction/Docling changes unrelated to the manual-flow slice.
3. If committing only this slice, likely intended files are `src/components/builder/projects-workspace.tsx`, `src/lib/server/actions.ts`, `src/lib/server/queries.ts`, `src/app/builder/handover-package/page.tsx`, `src/app/client/portal/page.tsx`, `WORKSHEET.md`, and this log, plus any prerequisite checklist files already intended for the branch.

## 2026-06-24 - Flooring/Waterproofing Glued OCR Escaped Generic Audit

### Trigger

User reported the same visible OCR issue class again:

`Waterproofmembraneunder tiles laidontimber floor inginwetareas. Engineered Timber Veneer flooring, timber veneerlaminated to astructuralplybase, straightlaid, glued to floor...`

### Findings

Current queue had 2 uploads and 76 rows. The exact bad row was:

- `e7dbbc46-5b70-4381-aff2-0da93db2c590`
- `Engineered timber veneer flooring`

A broader audit also found one remaining current dirty row:

- `13622991-f6c0-4112-95e7-35899c7fb54c`
- `Heated Towel Rail ensuite bed 1&2`
- `Timekeeperplustimer`, `Concealedwiring`

### Root Cause

The all-row final cleanup/audit existed, but the generic glued-OCR segmenter did not know flooring/waterproofing domain vocabulary. Tokens like `Waterproofmembraneunder`, `laidontimber`, `inginwetareas`, `veneerlaminated`, `astructuralplybase`, and `straightlaid` were not recognized as split-able dirty OCR because words such as `membrane`, `tiles`, `timber`, `wet`, `areas`, `veneer`, `laminated`, `structural`, `ply`, `base`, `straight`, and `laid` were missing from the generic segment/domain dictionaries.

So this was not that the user imagined it or that cleanup was impossible; the detector vocabulary was too narrow, which let domain-specific glued words pass as clean.

### Changes

- `src/lib/ai/spec-normalize.ts`
  - Added deterministic phrase repairs for:
    - `Waterproofmembraneunder` -> `Waterproof membrane under`
    - `laidontimber` -> `laid on timber`
    - `inginwetareas` -> `in wet areas`
    - `veneerlaminated` -> `veneer laminated`
    - `astructuralplybase` -> `a structural ply base`
    - `straightlaid` -> `straight laid`
    - `Timekeeperplustimer` -> `Timekeeper Plus timer`
    - `Concealedwiring` -> `Concealed wiring`
  - Extended generic OCR segment/domain word lists with flooring/waterproofing vocabulary.
- `src/lib/ai/spec-quality-audit.ts`
  - Added audit detection for those flooring/wet-area glued OCR tokens and towel-rail timer/wiring tokens.
- `src/lib/ai/spec-final-cleanup.ts`
  - Added flooring/wet-area examples to final LLM cleanup prompt.
- `scripts/fixtures/spec-final-quality-fixtures.json`
  - Added fixture `flooring_wet_area_glued_ocr_is_readable`.

### Verification

- `npm.cmd run spec-final-quality:fixtures` passed: 11 fixtures.
- `npm.cmd run spec-quality-audit:fixtures` passed: 6 fixtures.
- `npm.cmd run spec-normalizer:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-extract:fixtures` passed: 32 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT warnings.

### Current Data Backfill

Backfilled:

- `e7dbbc46-5b70-4381-aff2-0da93db2c590` / `Engineered timber veneer flooring`
- `13622991-f6c0-4112-95e7-35899c7fb54c` / `Heated Towel Rail ensuite bed 1&2`

Post-backfill audit across 76 rows for known OCR/diagnostic/false-code patterns returned `flaggedCount=0`.

### Remaining Work / Recommendation

- The next live upload still needs a restarted dev server to load these changes.
- If more glued OCR appears, do not only add exact phrase fixes; extend the generic segment/domain dictionary and final audit vocabulary for that domain.


## 2026-06-24 - PDL Faceplates False ProductCode and Visible OCR Audit

### Trigger

User reported another missed cleanup/field issue: `Whitefaceplates, ProductCode:` and asked to inspect for more issues.

### Findings

Current queue had 54 review/checklist rows. A scripted visible-field audit found 4 rows with similar issues:

- `dfdf99b6-7bea-424a-bc0c-a8d5e29388a6` / `Electrical Switching`
  - `Jconic`, `Whitefaceplates`, `PDLIconic`, `lifeeasy`
  - internal visible lines: `Has Identifier`, `Suggested Search Query`
  - false `ProductCode: 2017` extracted from `Winner of the 2017 Gold Design Award`
- `7c18850c-356d-4ddb-a5ef-53b673af26f9` / Robertson basin waste
  - `Vantiy Waste`
- `8486b7a9-58df-4be8-9e6f-c5289a4637cf` / WC toilet suite
  - `C/WSoft`
- `d1d9682c-084a-42ba-9eec-e19c46237058` / St Michel waste
  - `clickclackmushroom`

### Root Cause

- Deterministic product-code extraction accepted standalone years, so an award year became `ProductCode: 2017`.
- Internal helper fields from `buildStructuredEvidence` (`HasIdentifier`, `SuggestedSearchQuery`) were being persisted into visible evidence.
- LLM classifier default cap was still 30 candidates; with a 54-row queue it was not guaranteed every candidate would reach the LLM even though the user expects broad AI sorting.
- Quality audit/cleanup did not include the PDL faceplate and related OCR classes.

### Changes

- `src/lib/ai/spec-llm.ts`
  - Classifier now defaults on when `OPENAI_API_KEY` exists unless `OPENAI_SPEC_CLASSIFIER_ENABLED=false`.
  - Default classifier limit raised from 30 to 200.
- `src/lib/ai/spec-extract.ts`
  - Product-code extraction now filters standalone years when they are near award/range/marketing context.
  - Removed visible `HasIdentifier` / `SuggestedSearchQuery` lines from structured evidence.
- `src/lib/ai/spec-normalize.ts`
  - Added deterministic cleanup for `PDL Jconic Series`, `Whitefaceplates`, `PDLIconic`, `lifeeasy`, `Vantiy`, `C/WSoft`, and `clickclackmushroom`.
  - Final structured cleanup strips legacy `Has Identifier` / `Suggested Search Query` variants.
- `src/lib/ai/spec-quality-audit.ts`
  - Detects those OCR/diagnostic classes so they cannot pass silently.
- `src/lib/ai/spec-final-cleanup.ts`
  - Prompt now includes faceplate/Iconic examples.
- Fixtures added:
  - `scripts/fixtures/spec-extract-row-fixtures.json`: `pdl icon series faceplates does not use award year as product code`
  - `scripts/fixtures/spec-final-quality-fixtures.json`: `pdl_faceplates_visible_text_is_readable_and_no_diagnostics`

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 32 fixtures.
- `npm.cmd run spec-final-quality:fixtures` passed: 10 fixtures.
- `npm.cmd run spec-quality-audit:fixtures` passed: 6 fixtures.
- `npm.cmd run spec-candidates:fixtures` passed: 5 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 8 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT warnings.

### Current Data Backfill

Backfilled the 4 currently flagged rows and synced their checklist metadata/notes. The `Electrical Switching` checklist row now has `product_code = null` instead of `2017`, and visible evidence reads `PDL Iconic Series White faceplates ... life easy`.

A post-backfill scripted audit for the checked OCR/diagnostic/false-code patterns returned `flaggedCount=0`.

### Remaining Work / Recommendation

- Restart dev server before the next upload so the classifier limit/default-on and cleanup changes are active.
- On the next live route run, check diagnostics: classifier selected count should cover all eligible candidates up to 200, not stop at 30.
- If another issue appears, run the scripted visible-field audit first before fixing a single row.


## 2026-06-24 - Default AI OCR Spell Cleanup To All Rows

### Trigger

User found visible OCR garbage in a saved row despite repeated requests for AI spell/readability cleanup:

`3. 1 flush jamb for architraves Cus to msize 2400 mm x 1500 mm Need to check size`

### Root Cause

- Final save-boundary cleanup already defaulted to all-row mode when OpenAI final cleanup is enabled.
- But the pre-extraction table-row normalizer was still gated by `OPENAI_SPEC_NORMALIZER_ENABLED=true`; in the current `.env.local` it was unset, so the source table normalization stage did not run.
- The normalizer also selected only rows matching known messy heuristics, and this specific `Cus to msize` split-word class was missing from the quality audit, so it could pass through even though it was plainly wrong.

### Changes

- `src/lib/ai/spec-text-normalizer.ts`
  - OpenAI normalization now runs by default whenever `OPENAI_API_KEY` exists, unless explicitly disabled with `OPENAI_SPEC_NORMALIZER_ENABLED=false`.
  - Added `OPENAI_SPEC_NORMALIZER_MODE=all|messy|off`, defaulting to `all`.
  - Raised default normalizer limit to 200 so the real spec's table rows are all eligible for AI cleanup.
  - Added `Cus to msize` / `Custom msize` messy-row detection and prompt guidance.
- `src/lib/ai/spec-final-cleanup.ts`
  - Strengthened prompt examples for allowed final repairs: `Cus to msize -> Custom size`, `forarchitraves -> for architraves`, etc.
- `src/lib/ai/spec-normalize.ts`
  - Added deterministic cleanup for `Cus to msize` / `Custom msize` and preserved existing `Measurespecific` cleanup.
- `src/lib/ai/spec-quality-audit.ts`
  - Added final audit detection for `Cus to msize` / `Custom msize` so this class cannot pass silently again.
- `scripts/fixtures/spec-final-quality-fixtures.json`
  - Added fixture `flush_jamb_custom_size_spacing_is_readable`.

### Verification

- `npm.cmd run spec-final-quality:fixtures` passed: 9 fixtures.
- `npm.cmd run spec-quality-audit:fixtures` passed: 6 fixtures.
- `npm.cmd run spec-normalizer:fixtures` passed: 4 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Current Data Backfill

Backfilled current saved rows:

- Review row `1ee9eb73-665a-4013-8213-5fa14265e643`.
- Checklist row `77210baa-6d40-4ae0-8011-e881225ba806`.

Visible text now reads:

`flush jamb for architraves Custom size 2400 mm x 1500 mm Need to check size`

### Remaining Work / Recommendation

- Restart dev server before rerunning upload so default-on normalizer and prompt changes are active.
- Watch route diagnostics: `ai_text_normalizer.enabled` should be `true`, and selected row count should be broad/all-row up to the configured limit, not zero.
- If more OCR garbage appears, inspect whether normalizer/final cleanup actually ran and whether quality audit flagged it before adding another patch.


## 2026-06-24 - Split Multiple Real Items From One LLM Candidate

### Trigger

User caught a merged OCR/source row saved only as `Heated Towel Rail` even though the same text also contained `1 x Insinkera tor multitap` / `Insinkerator Multitap`.

### Root Cause

The LLM gate was being used for validity/classification, but the application layer effectively allowed only one surviving output item per deterministic candidate:

- prompt did not explicitly tell the model to emit multiple outputs for one merged source row;
- `applySpecLlmClassifications` keyed accepted classifications by `candidate_id` in a `Map`, so duplicate classifications for the same candidate overwrote each other;
- evidence assembly reused the parent proposal source/structured fields, which would pollute split child rows.

So the LLM was not actually able to fully "sort everything out" when Docling/OCR merged two products into one candidate.

### Changes

- Updated `src/lib/ai/spec-llm.ts` prompt: if one `source_text` contains multiple real handover items, return multiple classification objects with the same `candidate_id`, one per item.
- Updated `applySpecLlmClassifications` to group accepted classifications by candidate ID and split one proposal into multiple output proposals.
- For split source rows, evidence now prefers each classification's own `source_quote` and suppresses parent structured fallback fields so one item does not inherit another item's product code/finish.
- Added OCR cleanup for `Insinkera tor` -> `Insinkerator` in `src/lib/ai/spec-normalize.ts`.
- Updated `scripts/check-spec-llm-application-fixtures.mjs` to support fixture `classifications[]` and `expectedItems[]`.
- Added fixture `merged towel rail and insinkerator source row splits into two items` in `scripts/fixtures/spec-llm-application-fixtures.json`.
- Patched the reusable extraction skill with the multi-item candidate lesson.

### Verification

- `npm.cmd run spec-llm:fixtures` passed: 8 fixtures.
- `npm.cmd run spec-candidates:fixtures` passed: 5 fixtures.
- `npm.cmd run spec-final-quality:fixtures` passed: 8 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Current Data Backfill

Backfilled the currently affected upload `7b5bff9b-e1b4-4174-a12b-9edfe34095b4`:

- Inserted review row `605b8826-15a5-411d-858d-4b1e640e64db` titled `Insinkerator Multitap`.
- Inserted checklist row `aa8cbcef-214c-4418-ae9a-0de7300ba66a` titled `Insinkerator Multitap`.
- Row is marked for review/model-code clarification because the source only clearly had `1 x Insinkerator multitap` and no reliable model/code.

### Remaining Work / Recommendation

- Restart the dev server before any new browser upload so the changed classifier prompt/apply logic is active.
- Future merged rows should become multiple review/checklist candidates when the LLM emits multiple grounded classifications for the same source candidate.
- If another merged row still collapses, add it as a fixture and inspect whether the LLM failed to emit multiple classifications or whether validation rejected one.


## 2026-06-24 - Live Route Verification For LLM Valid-Item Gate

### Trigger

User asked to finish the implementation and run a test after adding LLM valid-item adjudication for broad source-document/admin bundles.

### Changes

- Extended `scripts/smoke-spec-route-quality.mjs` so live route smokes fail if saved review/checklist rows contain broad invalid source-document/admin bundles, especially producer-statements/code-compliance package rows.
- Kept the existing visible OCR checks in the same route smoke so the live test covers both readability and item validity.

### Static Verification

- `npm.cmd run spec-candidates:fixtures` passed: 5 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 7 fixtures.
- `npm.cmd run spec-final-quality:fixtures` passed: 8 fixtures.
- `npm.cmd run spec-quality-audit:fixtures` passed: 6 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Live Route Smoke

Restarted the dev server with Docling/OpenAI/final-cleanup all-mode and ran `npm.cmd run spec-route:quality-smoke`.

Result:

- Upload: `29ba0e0f-be5a-4a78-8bc8-aa6c2d886d45`
- HTTP: 200
- Saved review rows: 53
- Synced checklist rows: 53
- Normalizer selected/accepted/rejected: 50 / 46 / 4
- Classifier sent/accepted/rejected: 67 / 66 / 1
- Final cleanup dirty-before/sent/accepted/rejected/dirty-after: 2 / 53 / 53 / 0 / 0
- Repair retry sent/accepted: 0 / 0
- Final quality audit checked/pass: 53 / 53
- Bad visible review/checklist counts: 0 / 0
- Invalid producer/code-compliance review/checklist counts: 0 / 0

Direct DB inspection for the upload found:

- Review rows: 53
- Bad/invalid hits: 0
- Source-document-like saved rows: 0

### Cleanup

Cleared the smoke data after verification:

- Deleted 53 checklist rows/events.
- Deleted 1 specification upload, cascading 53 review rows.
- Deleted 1 throwaway route-quality smoke org/auth user.
- Final counts: uploads/review/checklist/events/smoke-orgs `0/0/0/0/0`.
- Stopped the dev server started for the smoke.

### Remaining Work / Recommendation

- User can now run a fresh browser flow from a clean state.
- If the browser flow surfaces a new invalid row, add it as an LLM validity fixture and tune the adjudication prompt/policy rather than suppressing one title.


## 2026-06-24 - LLM Valid Item Adjudication For Source Document Bundles

### Trigger

User pointed out that the pipeline should not just clean OCR; the LLM needs to decide whether a row is a valid handover item at all. Example: `Producer statements and code compliance documents` is a broad supporting-document/admin bundle, not a checklist item. User also noted remaining spelling/glued-word issues, which are now handled by the final readability gate after classification.

### Plan

Saved `.hermes/plans/2026-06-24_004650-llm-valid-item-adjudication.md`.

### Changes

- Changed `src/lib/ai/spec-candidates.ts` so deterministic `document` / `request_document` candidates are now sent to LLM validity adjudication instead of being skipped as deterministic source-document rows.
- Raised document/source-document candidates to spend priority 85 so they are reviewed before lower-value generic rows when classifier limits apply.
- Updated `src/lib/ai/spec-llm.ts` classifier prompt policy:
  - valid items are specific products, finishes, fixtures, systems, materials, appliances, maintenance tasks, or a specific source document tied to such an item;
  - broad supporting-document/admin bundles such as `Producer statements and code compliance documents`, CCC/PS closeout packages, consent closeout lists, or generic certificate bundles must be `keep=false`, `item_type=note`;
  - `needs_source_document` is reserved for a real specific product/system/finish/fixture that needs an attached quote/manual/warranty/certificate/producer statement/source document.
- Added fixtures:
  - `spec-candidates:fixtures`: deterministic source-document rows are LLM-eligible.
  - `spec-llm:fixtures`: producer-statements/code-compliance bundle is dropped as a non-item.
  - `spec-llm:fixtures`: a specific Grohe mixer warranty/source-document row is kept and formatted as a valid product needing a source document.
- Patched the reusable extraction-pipeline skill with the source-document/admin-bundle lesson.

### Verification

- `npm.cmd run spec-candidates:fixtures` passed: 5 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 7 fixtures.
- `npm.cmd run spec-extract:fixtures` passed: 31 fixtures.
- `npm.cmd run spec-final-quality:fixtures` passed: 8 fixtures.
- `npm.cmd run spec-quality-audit:fixtures` passed: 6 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Cleanup

Cleared stale extraction state after the code change:

- Before: uploads/review/checklist/events `1/74/72/72`.
- Deleted 72 checklist rows/events and 1 upload, cascading 74 review rows.
- After: uploads/review/checklist/events `0/0/0/0`.

### Remaining Work / Recommendation

- Restart the dev server before rerunning the browser upload so the new classifier prompt and candidate eligibility logic are active.
- On the next live flow, inspect `ai_classifier.sent_candidate_count`, accepted/rejected counts, and saved rows to confirm source-document/admin bundles are not entering the review/checklist queue.
- If a broad admin bundle still appears, capture it as a fixture and tighten the LLM validity policy rather than adding a one-off title suppression.


## 2026-06-24 - Generic Fail-Closed Readability Repair Gate

### Trigger

User correctly called out that exact OCR-token patches are counterintuitive and would require endless passes to catch future garbage. We pivoted from whack-a-mole phrase matching to a generic fail-closed readability gate: repair what can be safely repaired, retry unresolved rows through the LLM cleanup with issue examples, and explicitly mark anything still unreadable for manual OCR cleanup rather than presenting it as clean.

### Plan

Saved the implementation plan at `.hermes/plans/2026-06-24_003900-fail-closed-readability-repair-gate.md`.

### Changes

- Added generic glued OCR segmentation in `src/lib/ai/spec-normalize.ts`:
  - detects long lowercase compounds made from known construction/domain terms plus connectors;
  - repairs unseen tokens such as `mountedonleftsidewall`, `slidesfromrighttoleftwhenfacingdoor`, and `shelftobemountedonrearwall` without needing exact phrase entries;
  - exposes `findGenericGluedOcrTokens()` for audit/detection.
- Expanded `src/lib/ai/spec-quality-audit.ts` to flag generic glued OCR tokens, not just historical bad strings.
- Added a final repair retry loop in `src/lib/ai/spec-final-cleanup.ts`:
  - after normal final cleanup, run the quality audit;
  - send only failed rows back through OpenAI final cleanup with quality issues/examples;
  - re-clean and re-audit;
  - any unresolved row receives an explicit `Evidence text needs manual cleanup (...)` quality review note.
- Added final cleanup response diagnostics in `src/lib/server/specification-response.ts`:
  - `repair_retry_sent_count`
  - `repair_retry_accepted_count`
- Added process-route logging for repair retry and unresolved quality counts.
- Updated fixture harnesses and fixtures:
  - final quality fixtures now verify generic segmented repair and fail-closed manual cleanup notes;
  - quality audit fixtures now verify unseen generic glued tokens and suspicious unreadable token density.
- Patched the reusable `source-backed-extraction-pipelines` skill note with the new fail-closed debugging lesson.

### Verification

- `npm.cmd run spec-final-quality:fixtures` passed: 8 fixtures.
- `npm.cmd run spec-quality-audit:fixtures` passed: 6 fixtures.
- `npm.cmd run spec-normalizer:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-extract:fixtures` passed: 31 fixtures.
- `npm.cmd run spec-candidates:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 5 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.
- Verified Supabase extraction queues are clear: uploads/review/checklist/events `0/0/0/0`.

### Remaining Work / Recommendation

- Restart the dev server before the next browser upload so the updated route/server code is active.
- For future visible OCR failures, add fixtures for the class, but prefer generic readability/segmentation/audit improvements over exact phrase fixes.
- A live browser/route rerun is still useful to observe actual `repair_retry_*` diagnostics on the real PDF.


## 2026-06-24 - Shower Direction OCR Regression Fix

### Trigger

User ran a fresh flow and surfaced a Master Ensuite shower row still showing visible OCR glue: `overlapsbothfixedpanels`, `stand ingfacing`, `outsideof`, `shelfon`, `sideonend`, and `bemountedonback`. This showed the prior route smoke passed because the forbidden-token list and audit patterns were too narrow for glued shower-direction/preposition classes.

### Changes

- Added generic deterministic cleanup in `src/lib/ai/spec-normalize.ts` for shower direction/layout OCR glue:
  - `RHWhen` -> `RH When`
  - `Whenst and ing` / `stand ingfacing` -> `When standing` / `standing facing`
  - `lookingat`, `outsideof`, `shelfon`, `sideonend`, `bemountedonback`
  - `fixedpanel(s)`, `overlapsbothfixedpanels`, `mm-slides`, `NB:Slide`
- Expanded `hasLikelyDirtyOcrText()` and `src/lib/ai/spec-quality-audit.ts` so these glued shower-direction tokens are flagged if they ever escape cleanup.
- Added regression fixtures:
  - `spec-final-quality:fixtures` now includes `shower_direction_glued_words_are_readable`.
  - `spec-quality-audit:fixtures` now includes `flags_glued_shower_direction_tokens`.
- Expanded `scripts/smoke-spec-route-quality.mjs` forbidden visible-text checks so route smokes fail on these classes too.

### Verification

- `npm.cmd run spec-final-quality:fixtures` passed: 6 fixtures.
- `npm.cmd run spec-quality-audit:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-normalizer:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-extract:fixtures` passed: 31 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT warnings.

### Cleanup

Cleared the stale failed browser rerun after patching:

- Before: uploads/review/checklist/events `1/72/70/70`.
- Deleted 70 legacy checklist rows/events and 1 upload, cascading 72 review rows.
- After: uploads/review/checklist/events `0/0/0/0`.

### Remaining Work / Recommendation

- User should restart the dev server before rerunning the browser upload, because route/server code changed.
- If another visible OCR class appears, add it as a generic fixture/audit pattern before clearing/retrying; do not treat it as a one-row backfill.


## 2026-06-24 - Cleared Extraction Queue For Fresh User Flow

### Trigger

User asked to clean up after verification and clear the review queue so they can run a fresh user flow and inspect any remaining issues from a clean state.

### Actions

- Reviewed the current worktree diff at a high level. The working tree contains many existing modified/untracked files from broader checklist/extraction work; commit/staging should be selective rather than assuming every changed file belongs to the quality-hardening slice.
- Audited the latest live route smoke upload before deleting it: upload `3daef1f7-cc6c-451c-8133-8a02de0f7d28` had 57 review rows, bad visible text count `0`, and manual quality-note count `0`.
- Deleted Supabase extraction/review state for a clean rerun:
  - 170 legacy checklist candidate rows, with checklist events removed by cascade;
  - 3 `specification_uploads`, cascading 176 `extracted_handover_items` review rows;
  - 3 throwaway route-quality smoke organisations/auth users created by the smoke harness.

### Verification

Final Supabase counts after cleanup:

- `specification_uploads`: 0
- `extracted_handover_items`: 0
- `project_handover_checklist_items`: 0
- `project_handover_checklist_events`: 0
- route-quality smoke orgs: 0

### Remaining Work / Recommendation

- Hunter can now run a fresh browser user flow from a clean extraction/review/checklist state.
- If the next browser flow surfaces issues, add generic fixtures for the failure class before changing extraction logic.
- Before committing, inspect/stage carefully because this worktree includes pre-existing modified/untracked files from earlier slices.


## 2026-06-24 - Extraction Quality Hardening Save-Boundary Audit

### Trigger

User reported that the Docling/OpenAI flow still allowed human-visible OCR garbage and internal classifier diagnostics into saved review rows (`stand ing`, `lmainspressureelectric`, `kwelement`, `the rmostat`, `throostat`, and `LLMReviewLane:`). User explicitly asked for systemic quality gates and generic fixtures, not one-off row patches.

### Changes

- Added `src/lib/ai/spec-quality-audit.ts` to audit final visible `extracted_text` / `source_snippet` for diagnostic leakage, split words, glued service/unit text, OCR misspellings, and suspicious token density.
- Added final-quality and audit fixture harnesses:
  - `scripts/fixtures/spec-final-quality-fixtures.json`
  - `scripts/check-spec-final-quality-fixtures.mjs`
  - `scripts/fixtures/spec-quality-audit-fixtures.json`
  - `scripts/check-spec-quality-audit-fixtures.mjs`
  - npm scripts `spec-final-quality:fixtures` and `spec-quality-audit:fixtures`.
- Removed visible `LLMReviewLane:` / `LLMReviewReason:` embedding from `src/lib/ai/spec-llm.ts`; classifier lane/reason are now structured proposal fields and are appended to review diagnostics via `review_reason`, not visible evidence text.
- Changed final evidence cleanup in `src/lib/ai/spec-final-cleanup.ts` to support `OPENAI_SPEC_FINAL_CLEANUP_MODE=all|dirty|off`; local/demo all-mode sends all final visible rows through cleanup in batches, then runs the final quality audit.
- Added response diagnostics in `src/lib/server/specification-response.ts` under `final_quality_audit` and expanded `final_evidence_cleanup.mode`.
- Broadened `src/lib/ai/spec-text-normalizer.ts` messy-row selection with generic OCR-class patterns and priority buckets, so severe OCR rows are selected before lower-risk messy rows.
- Added low-risk deterministic OCR fallback repairs in `src/lib/ai/spec-normalize.ts` for split words, hot-water unit/service text, compact finish descriptions, and dropped location letters.
- Added live route quality smoke `scripts/smoke-spec-route-quality.mjs` / `npm.cmd run spec-route:quality-smoke`; it can create a throwaway Supabase user/org/project, POST the real spec PDF to the live route, then query saved review/checklist rows for forbidden visible text.
- `/api/specifications/extract-pdf` now also runs final cleanup/audit, so preview responses use the same visible-evidence boundary as the save route.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 31 fixtures.
- `npm.cmd run spec-normalizer:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-candidates:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 5 fixtures.
- `npm.cmd run spec-final-quality:fixtures` passed: 5 fixtures.
- `npm.cmd run spec-quality-audit:fixtures` passed: 3 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.
- Fresh live route smoke after dev-server restart with Docling/OpenAI/final-cleanup all-mode passed. Upload `3daef1f7-cc6c-451c-8133-8a02de0f7d28` returned HTTP 200:
  - saved review rows: 57
  - synced checklist rows: 55
  - normalizer selected/accepted/rejected: 53 / 51 / 2
  - classifier sent/accepted/rejected: 63 / 63 / 0
  - final cleanup dirty-before/sent/accepted/rejected/dirty-after: 2 / 57 / 56 / 1 / 0
  - final quality audit pass/checked: 57 / 57
  - bad visible review/checklist counts: 0 / 0

### Remaining Work / Recommendation

- Keep `OPENAI_SPEC_FINAL_CLEANUP_MODE=all` for local/demo investor prep. Production can tune limits or use dirty-mode only after a cost/quality decision.
- If future rows are flagged by `final_quality_audit`, add generic fixtures for the new OCR/readability class and improve the relevant boundary before retesting; do not backfill one row only.
- The route smoke creates throwaway Supabase auth/org/project/upload data. Clean these later if demo database tidiness matters.


## 2026-06-24 - Saved Row Quality Audit And Systemic Dedupe

### Trigger

After final evidence cleanup reached zero dirty saved rows, user asked to continue reviewing row quality/coverage instead of stopping at OCR cleanliness.

### Changes

- Audited the latest spec extraction output by compacted source evidence, generic titles, category precedence, and inferred rows.
- Added systemic extraction fixes in `src/lib/ai/spec-extract.ts`:
  - suppress generic schema-row duplicates when a canonical source-backed proposal already covers the same evidence;
  - prevent generic titles such as `Bathroom&`, `Fittings`, `Ceramic tiles Area`, and `Raft Slab` from surviving alongside better canonical rows;
  - improve category precedence for tiles, cladding, plumbing fixtures, and paint/finish rows;
  - stop creating the inferred `Wash exterior cladding and painted finishes` maintenance task from product-only cladding evidence.
- Expanded OCR/readability normalization in `src/lib/ai/spec-normalize.ts` for compliance-document and custom-carpet patterns surfaced by the quality audit.
- Added conservative final save-boundary dedupe/category normalization in `src/lib/ai/spec-final-cleanup.ts` so LLM title/category variation does not reintroduce same-source duplicates after classification.
- Added regression fixtures to `scripts/fixtures/spec-extract-row-fixtures.json`; fixture count is now 31.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 31 fixtures.
- `npm.cmd run spec-normalizer:fixtures` passed: 3 fixtures.
- `npm.cmd run spec-candidates:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 5 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.
- In-process Docling markdown + OpenAI smoke using `.local-artifacts/docling/2074-legal-signed-outline-spec.md` and the normalizer/classifier/final-cleanup path returned:
  - deterministic proposals: 65
  - final items: 57
  - normalizer selected/accepted/rejected: 50 / 49 / 1
  - classifier candidates/needs/sent/accepted/rejected: 65 / 63 / 63 / 63 / 0
  - final cleanup dirty-before/sent/accepted/rejected/dirty-after: 5 / 5 / 5 / 0 / 0
  - dirty count after final cleanup: 0
  - suspicious generic title count: 0
  - remaining shared-source group: `Engineered timber veneer flooring` plus `Waterproof membrane under wet-area tiles`, intentionally left separate because flooring and waterproofing are distinct handover concepts from the same source row.

### Remaining Work / Recommendation

- Restart the dev server before the next browser/API route smoke because route/server extraction code changed.
- Fresh live `/api/specifications/process-pdf` route smoke has now passed after restarting the dev server: upload `b747b824-08b3-462e-af4a-c872471d9702`, saved 60 review rows, synced 58 checklist rows, final cleanup dirty-before/sent/accepted/rejected/dirty-after `5/5/5/0/0`, dirty review/checklist counts `0/0`, suspicious generic title count `0`, and only the intentional flooring/waterproofing shared-source group remained.
- Continue coverage review next: compare final rows against the original spec sections to identify missed products/finishes/documents, and add any misses as regression fixtures before changing extraction logic.

## 2026-06-24 - Final Evidence Cleanup Diagnostics And Smoke Verification

### Trigger

User wanted the next step completed now: expose the final evidence cleanup quality-gate counts in the API response, then rerun the real Docling/OpenAI spec extraction path and avoid one-off OCR phrase fixes.

### Changes

- Added `finalEvidenceCleanupResult` plumbing to `src/lib/server/specification-response.ts`.
- `/api/specifications/process-pdf` responses now include `final_evidence_cleanup` with enabled, dirty-before, sent, accepted, rejected, dirty-after, token usage, and error-count diagnostics.
- Tightened `src/lib/ai/spec-final-cleanup.ts` so if the AI final cleanup repairs the structured `Description:` but leaves `source_snippet` dirty, the save-boundary gate can use the cleaned Description as the readable source snippet rather than persisting glued OCR.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 24 fixtures.
- `npm.cmd run spec-normalizer:fixtures` passed: 3 fixtures.
- `npm.cmd run spec-candidates:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 5 fixtures.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.
- Fresh live Supabase smoke against `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf` returned HTTP 200 and saved specification upload `fe738086-995f-4fab-a8bf-744d1444ecff`:
  - `saved_count`: 65
  - `ai_text_normalizer.enabled`: true
  - normalizer selected/accepted/rejected: 50 / 49 / 1
  - `ai_classifier.enabled`: true
  - classifier candidates/needs/sent/accepted/rejected: 70 / 67 / 67 / 65 / 2
  - `final_evidence_cleanup.enabled`: true
  - `final_evidence_cleanup.dirty_before_count`: 0
  - `final_evidence_cleanup.dirty_after_count`: 0
- Direct DB verification for that upload found:
  - review rows: 65
  - dirty review rows: 0
  - old dirty phrase hits: none
  - synced checklist rows for the upload: 63
  - dirty checklist rows: 0

### Remaining Work / Recommendation

- Keep using `final_evidence_cleanup.dirty_after_count` as the save-boundary invariant. If it rises above zero, query the saved rows and improve detector/prompt/validation/evidence assembly systemically; do not add item-specific phrase fixes.
- The smoke project/data created during testing is `Hermes Smoke Spec Cleanup Test`; decide later whether to keep it for inspection or clean it before demo data prep.

## 2026-06-23 - LLM OCR/Text Normalization Pass

### Trigger

User pointed out that continuing to add deterministic spacing fixtures for every missing/extra-space pattern would not generalize well to new documents. The prior OpenAI tests were cheap enough to justify an AI pass that repairs OCR/readability issues before extraction/classification.

### Changes

- Added `src/lib/ai/spec-text-normalizer.ts`:
  - selects messy Docling table rows using glued-word/camelcase/spacing heuristics;
  - calls OpenAI Responses with a strict JSON schema;
  - asks for spacing/spelling/punctuation repair only, with explicit no-invention instructions;
  - validates output by rejecting high-risk rewrites, missing normalized text, invalid confidence, oversized rewrites, and dropped source product codes;
  - applies accepted rewrites back into table-like markdown for downstream extraction.
- Added `scripts/check-spec-text-normalizer-fixtures.mjs` and `scripts/fixtures/spec-text-normalizer-fixtures.json`.
- Added npm scripts:
  - `spec-normalizer:fixtures`
  - `spec-normalizer:smoke`
- Wired the normalizer into both `/api/specifications/extract-pdf` and `/api/specifications/process-pdf` behind `OPENAI_SPEC_NORMALIZER_ENABLED=true`, before deterministic proposal building and before the existing LLM classifier.
- Added `ai_text_normalizer` diagnostics to extraction responses.
- Added a few deterministic phrase fixes surfaced by the live normalizer smoke (`topographical`, `standard`, `upstand`, `therefore`).

### Verification

- `npm.cmd run spec-normalizer:fixtures` passed: 3 fixtures.
- Live bounded smoke: `OPENAI_SPEC_NORMALIZER_LIMIT=10 OPENAI_SPEC_NORMALIZER_BATCH_SIZE=5 npm.cmd run spec-normalizer:smoke`:
  - input rows: 166
  - selected rows: 10
  - accepted: 8
  - rejected: 2 high-risk rewrites
  - token usage: 4,354 total tokens
  - useful repairs included `tobe suppliedby` -> `to be supplied by`, spaces around `&`, `frombenchtop` -> `from bench top`, and `undersideof` -> `underside of`.
- `npm.cmd run spec-extract:fixtures` passed: 22 fixtures.
- `npm.cmd run spec-candidates:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 86 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Remaining Work / Recommendation

- Next run a real browser upload smoke with both `OPENAI_SPEC_NORMALIZER_ENABLED=true` and existing classifier settings enabled. Inspect `ai_text_normalizer` diagnostics, changed row samples/logs, review rows, and checklist candidates.
- Keep the normalizer conservative. Do not auto-accept high-risk rewrites; add UI/debug surfacing only if needed.
- If browser output is materially cleaner, move from extraction tuning into checklist item detail/editing UX for the investor demo.

## 2026-06-23 - Product Category/Title Oddity Cleanup

### Trigger

After electrical category cleanup, the remaining targeted extraction-quality oddities included `Engineered Timber` landing as `Tiles` because its row also mentioned waterproof membrane under tiles, and a St Michel powder-room drawer vanity row being titled `St Michel waste` because the notes mentioned drilling for waste/mixer. A cavity-slider row also needed a regression guard so bathroom privacy-set wording would not steal it from `Doors and hardware` in future deterministic extraction.

### Changes

- Added three regression fixtures to `scripts/fixtures/spec-extract-row-fixtures.json`:
  - cavity slider handles stay `Doors and hardware` despite bathroom/WC privacy set text;
  - engineered timber flooring stays `Flooring` despite nearby tile/membrane text;
  - St Michel drawer vanity row becomes `St Michel Vanity` / `Bathroom fixtures`, not `St Michel waste`.
- Updated `src/lib/ai/spec-extract.ts` category/title precedence:
  - door-hardware signals such as cavity slider/lever handles/privacy sets are handled before generic bathroom terms;
  - engineered timber/timber veneer/flooring terms are handled before tile terms;
  - St Michel vanity/drawer/vessel-basin/top-panel/accent-strip rows get a vanity title/category before waste/mixer notes can dominate.
- Backfilled the current Supabase review/checklist rows for the product `Engineered Timber Flooring` row and the St Michel vanity row. A focused query now finds no remaining target suspicious rows (`Engineered Timber` as `Tiles` or `St Michel waste`).

### Verification

- Live counts remain:
  - `extracted_handover_items`: 87
  - `specification_uploads`: 1
  - `extracted_items`: 0
  - `project_handover_checklist_items`: 85
- `npm.cmd run spec-extract:fixtures` passed: 22 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 86 proposals. The proposal count dropped by one because the St Michel vanity fixture no longer creates the spurious separate `St Michel waste` proposal.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Remaining Work

- Extraction/checklist quality is now materially cleaner for the investor-demo path. Remaining extraction refinements can be smaller: repeated/groupable shower/vanity/flooring variants, heated towel rail category semantics, and eventual migration away from the legacy `extracted_handover_items` upload path.
- UI rework remains parked unless the next priority shifts.

## 2026-06-23 - Electrical Category Inference Cleanup

### Trigger

The next extraction quality slice after source-document de-duplication was wrong category assignment for electrical/sensor/power rows. Live Supabase review rows had electrical items categorized as `Doors and hardware` or `Bathroom fixtures`, including `LED sensor light`, `Light sensor`, `Appliance wire & fit power points and connection`, and `Mirror Light Master Ensuite`.

### Root Cause

`inferCategory()` checked bathroom and door keywords before electrical keywords. Rows such as `Back door LEDSensor Light` and `Entry&garage doorx 1, back doorx 1` therefore matched `door` first; `Mirror Light Master Ensuite` matched `mirror` before `light`; and power-point rows with `Auto door` matched door hardware before electrical intent.

### Changes

- Added `expectedCategory` support to `scripts/check-spec-extract-fixtures.mjs`.
- Added four category regression fixtures to `scripts/fixtures/spec-extract-row-fixtures.json` for:
  - back-door LED sensor light;
  - light sensor near entry/garage/back doors;
  - auto-door power-point connection;
  - master-ensuite mirror pendant light.
- Added OCR normalization for `LEDSensor` -> `LED Sensor` in `src/lib/ai/spec-normalize.ts`.
- Added an electrical category signal helper in `src/lib/ai/spec-extract.ts` and run it before bathroom/door/category fall-through. It covers `lights?`, `downlights?`, `pendants?`, `powerpoint`, `switch`, `sensor`, `wire`, `electrical`, `circuit`, `outlet`, `RJ45`, `patch panel`, and `Cat6`.
- Backfilled current Supabase review rows and checklist rows for the four affected live items; current focused query finds no electrical-ish rows categorized as `Doors and hardware` or `Bathroom fixtures`.

### Verification

- Live counts remain:
  - `extracted_handover_items`: 87
  - `specification_uploads`: 1
  - `extracted_items`: 0
  - `project_handover_checklist_items`: 85
- `npm.cmd run spec-extract:fixtures` passed: 19 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 87 proposals; electrical rows now classify correctly in the smoke output.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Remaining Work

- Next fixture-backed extraction quality slice could group repeated shower/vanity/flooring variants or clean title/category oddities outside the electrical cluster (for example `Cavity Slider Handles` as bathroom fixtures, `Engineered Timber` as tiles, or `Heated Towel Rail` as tapware).
- UI rework remains parked.

## 2026-06-23 - Superior Kitchens Source-Document De-Duplication

### Trigger

After fixing checklist sync, the next extraction-quality issue was duplicate source-document rows around the same Superior Kitchens quote. The live queue had individual document rows for `Kitchen`, `Scullery`, `Laundry`, `Entertainment Unit- drawers`, `LED Light strips`, and an LLM-derived `Kitchen joinery quote reference`, in addition to the canonical `Kitchen and joinery supplier quote/source document`.

### Changes

- Added fixture coverage to `scripts/fixtures/spec-extract-row-fixtures.json` so Superior Kitchens quote-only rows must collapse to the canonical source-document request and must not create `Kitchen`, `Scullery`, `Laundry`, `Entertainment Unit- drawers`, or `Kitchen, scullery and laundry joinery` proposals.
- Added source-document-reference detection in `src/lib/ai/spec-extract.ts`:
  - schema/table rows that only say `as per quote/invoice/schedule/manual/warranty/certificate` are skipped as product rows;
  - non-document extraction rules are also suppressed when the selected evidence is only a source-document reference;
  - audit output now labels these skipped rows as `source_document_reference` rather than silent drops.
- Backfilled the current Supabase review queue by deleting 6 redundant legacy source-document rows. The remaining document rows are the canonical Superior Kitchens source-document row and the producer/code-compliance document row.

### Verification

- Current live counts after backfill:
  - `extracted_handover_items`: 87
  - `specification_uploads`: 1
  - `extracted_items`: 0
  - `project_handover_checklist_items`: 85
  - `project_handover_checklist_events`: 85
- `npm.cmd run spec-extract:fixtures` passed: 15 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 87 proposals. The removed rows show in audit as `source_document_reference`, so recall is explicit rather than silent.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Remaining Work

- Next fixture-backed quality target: wrong categories for electrical/sensor/power rows currently landing under doors/bathroom fixtures, or grouping repeated shower/vanity/flooring variants.
- UI rework remains parked.

## 2026-06-23 - Legacy Specification Rows Sync Into Checklist Candidates

### Trigger

User asked to inspect the latest 93-row extraction output and prove whether it was good enough for an investor demo, with special focus on whether review rows were flowing into the project checklist.

### Findings

- Live Supabase counts before the fix:
  - `extracted_handover_items`: 93
  - `specification_uploads`: 1
  - `extracted_items`: 0
  - `project_handover_checklist_items`: 0
- Root cause: the current browser specification upload path is still `/api/specifications/process-pdf`, which writes legacy `extracted_handover_items`; the newer checklist sync only ran for the richer `extracted_items` document workflow in `src/lib/server/actions.ts`.
- The latest rows are broadly demo-useful, but remaining quality issues to tune later include duplicate/groupable rows (`Showers Bed 1&2`, engineered timber flooring, vanity/toilet-roll variants), duplicated source-document/quote rows for Superior Kitchens, and a few wrong categories around electrical/sensor rows. These are not as blocking as the checklist sync gap.

### Changes

- Added legacy checklist sync to `/api/specifications/process-pdf` after both normal and fallback legacy inserts.
- Added `legacy_extracted_handover_item_id` to the checklist migration with a unique partial index so legacy review rows can be upserted without conflicting with the newer `source_extracted_item_id` path.
- Applied the Supabase schema change directly using `SUPABASE_DB_URL`.
- Backfilled the current live upload: 85 non-document legacy review rows became `project_handover_checklist_items`, with source snippets/review notes stored in `source_metadata` and 85 checklist events inserted.
- Updated `HANDOFF.md` and `WORKSHEET.md` with the legacy-path diagnosis and current counts.

### Verification

- REST/direct count after backfill: `project_handover_checklist_items=85`; legacy column selectable through REST.
- `npm.cmd run spec-extract:fixtures` passed: 15 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 93 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT trace warnings.

### Remaining Work

- Next extraction quality fixes should be fixture-backed: group or de-dupe repeated real items, especially shower/vanity/flooring variants; collapse duplicate Superior Kitchens source-document request rows; and correct wrong category assignment for electrical/sensor rows.
- Decide whether to route spec upload fully through the newer `uploaded_documents`/`document_extraction_jobs`/`extracted_items` workflow, or keep the compatibility bridge until the UI is moved.
- UI rework remains parked until checklist/extraction flow is proven.

## 2026-06-22 - Extraction Rows Sync Into Checklist Candidates

### Trigger

User asked to continue after applying the Supabase checklist migration. The next planned slice was to make Docling/OpenAI extraction results create/update checklist candidates instead of staying only in the extraction review queue.

### Changes

- Extended the checklist contract with `sourceExtractedItemId`, `sourceDocumentId`, and `extractionJobId`.
- Extended `docs/supabase-add-project-handover-checklist.sql` with source columns and a unique index on `source_extracted_item_id`; reran it against Supabase.
- Updated checklist queries/actions to select and persist the source identifiers.
- Added extraction-to-checklist mapping in `src/lib/server/actions.ts`:
  - product/category/brand/manufacturer/model/supplier fields become checklist identity fields;
  - `maintenanceText` becomes care instructions requiring review;
  - `warrantyText` becomes warranty information requiring review;
  - source document IDs become supporting documents requiring review;
  - source page/section/snippet are preserved in notes and metadata;
  - synced items are upserted by `source_extracted_item_id` so retries update instead of duplicating.
- Wired sync into both Supabase and local document processing after product matching so the checklist receives final match/review state metadata.
- Added checklist sync metrics into extraction job usage metrics.

### Verification

- Direct DB verification: source columns `source_extracted_item_id`, `source_document_id`, and `extraction_job_id` exist; unique source index exists.
- REST verification: selecting source columns from `project_handover_checklist_items` returned `200 []`.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed. Known Docling/Turbopack NFT warnings remain.

### Remaining Work

- Run a browser upload smoke with Docling enabled to confirm real upload -> extraction -> checklist item flow in the UI.
- Add database autocomplete/match review.
- Add richer item detail editing/upload controls for manual/care/warranty/invoice/Code-of-Compliance sections.
- Wire guarded source-search review into checklist items.
- Update publish readiness and client portal output to use checklist state.

## 2026-06-22 - Supabase Checklist Migration Applied

### Trigger

User asked to move to the next step after the first checklist UI slice, meaning apply/verify the Supabase checklist migration.

### Changes

- Tightened `docs/supabase-add-project-handover-checklist.sql` so it is public-schema-qualified and policy-idempotent with `drop policy if exists` before policy creation.
- Applied the SQL using ignored `.env.local` `SUPABASE_DB_URL`; no secret values were printed.

### Verification

- Direct DB verification before migration: `projects=yes`, `organisation_members=yes`, `uploaded_documents=yes`; checklist tables were missing.
- Direct DB verification after migration: `project_handover_checklist_items=yes`, `project_handover_checklist_events=yes`.
- Policy verification: four policies installed across the two checklist tables.
- REST verification with service role: both `/rest/v1/project_handover_checklist_items?select=id&limit=1` and `/rest/v1/project_handover_checklist_events?select=id&limit=1` returned `200 []`.

### Remaining Work

- Next implementation slice should wire Docling/OpenAI extraction rows into checklist candidates and start replacing the old extraction-only mental model in the workspace.
- After that, add database autocomplete/match review, richer item detail editing/upload controls, guarded source-search review, and publish readiness/client portal mapping.

## 2026-06-22 - Checklist First Slice Implemented

### Trigger

Implemented the first demo-ready slice from `.hermes/plans/2026-06-22_000000-project-handover-checklist-pivot.md` so the project workspace starts behaving like a handover item checklist rather than only an extraction review surface.

### Changes

- Added `src/lib/project-handover-checklist.ts` with checklist item statuses, section statuses, value sources, search-identity check, missing-section helper, status derivation, and item builder.
- Added local scaffold persistence in `src/lib/server/local-store/project-handover-checklist.ts`, storing `.local-data/project-handover-checklist.json` items and events.
- Added Supabase migration draft `docs/supabase-add-project-handover-checklist.sql` for `project_handover_checklist_items` and `project_handover_checklist_events` with project/member RLS policies.
- Added `getProjectHandoverChecklistItems()` and wired it into `/builder/projects` data loading.
- Added server actions for creating checklist items, updating checklist items, and accepting items incomplete with a paper trail. If Supabase is configured but the checklist tables are not migrated yet, the action/query paths fall back to local scaffold storage instead of blocking the UI.
- Added a `/builder/projects` checklist dashboard with metrics, Add checklist item form, explicit `Not enough information to search` prompt, section status chips, and accepted-incomplete reason capture.

### Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed. Build still emits the known Docling/Turbopack NFT trace warnings from `next.config.ts`/`src/lib/server/docling.ts`; no type or build errors remain.

### Remaining Work

- Apply `docs/supabase-add-project-handover-checklist.sql` to the Supabase project when ready; until then, Supabase-mode checklist writes fall back to local JSON.
- Wire existing Docling/OpenAI extraction rows into checklist item creation/update.
- Add database autocomplete and match-review modal.
- Add richer item detail editing and document upload/replace controls per care/manual/warranty/invoice/Code-of-Compliance section.
- Wire guarded source-search result review into checklist items.
- Update publish readiness and client portal output to use checklist completion/accepted-incomplete state.

## 2026-06-22 - Checklist-First Handover Item Documentation Pivot

### Trigger

Investor feedback changed the product flow away from a spec-upload-first mental model toward a project handover item checklist. The app must help collect care instructions, manuals, warranties, invoices, Code of Compliance information, uploaded documents, and notes for each project item without pretending to know vague products.

### Decisions Captured

- `/builder/projects` should become the primary checklist dashboard for project handover items.
- Specs, quotes, invoices, manuals, warranties, supplier schedules, photos, and other uploads are accelerators for creating/updating checklist items, not completion authority.
- Database autocomplete/matching runs before source search.
- Similar database matches must be shown for user selection; the app must not guess.
- Source/web search is allowed only when enough item identity exists.
- Vague items are explicitly `Not enough information to search` and should prompt for brand/manufacturer/supplier/model/SKU/invoice/photo/document upload or manual entry.
- Autofilled database/source information remains editable and `Needs review` until user confirmation.
- Items can proceed as accepted incomplete only with paper-trail metadata showing what was missing, who accepted it, and when.

### Files Updated

- Added `docs/project-handover-item-documentation-flow.md`.
- Updated `docs/product-brief.md`, `docs/phased-work.md`, `docs/architecture.md`, `docs/implementation-phases.md`, `docs/technical-architecture-source-of-truth.md`, `HANDOFF.md`, and `WORKSHEET.md` to point future agents at the checklist-first flow.
- Saved the implementation plan under `.hermes/plans/2026-06-22_000000-project-handover-checklist-pivot.md`.

### Next Step

Implement the saved checklist-pivot plan. Start with the data/status contract and persistence, then update `/builder/projects` into the checklist dashboard and add the item modals before rewiring extraction/search/publish flows.

## 2026-06-22 - OpenAI 520 Retry And Clean Rerun Prep

### Trigger

During the browser full PDF process, OpenAI returned Cloudflare `520: Web server is returning an unknown error` from `api.openai.com`. The route caught the exception, fell back to deterministic extraction, and saved 97 rows with no LLM classifications.

### Root Cause

The failure was at the OpenAI API boundary, not Docling or deterministic extraction: Docling completed (`provider: docling_local`) and proposal generation returned 97 deterministic rows. The route fallback also hid candidate diagnostics by returning `candidates: []` in the catch block.

### Changes

- Added retry handling around OpenAI Responses calls for retryable statuses: 408, 409, 429, and 5xx, including the observed 520.
- Set local test env to smaller batches: `OPENAI_SPEC_CLASSIFIER_BATCH_SIZE=10` and `OPENAI_SPEC_CLASSIFIER_RETRY_ATTEMPTS=3`.
- Kept candidate diagnostics on fallback in both preview and process routes by rebuilding deterministic candidates instead of returning an empty candidate list.
- Cleared the failed deterministic-only test upload from Supabase:
  - `extracted_handover_items`: 97 -> 0
  - `specification_uploads`: 1 -> 0

### Verification

- `npm.cmd run spec-llm:fixtures` passed.
- `npm.cmd run lint` passed.
- `OPENAI_SPEC_CLASSIFIER_LIMIT=10 OPENAI_SPEC_CLASSIFIER_BATCH_SIZE=5 OPENAI_SPEC_CLASSIFIER_RETRY_ATTEMPTS=3 npm.cmd run spec-extract:llm-smoke` passed: 10 sent, 9 accepted, 1 rejected, 3,374 tokens.
- `npm.cmd run build` passed with known Docling/Turbopack NFT warnings.

### Next Step

Restart the dev server so the route code and `.env.local` batch-size changes are loaded, then rerun the browser upload. If OpenAI is still unstable, logs should now show retry warnings first; if it still falls back, diagnostics will still show candidate and eligibility counts instead of zeros.

## 2026-06-22 - LLM-First Source-Backed Spec Review Implementation

### Trigger

Implemented `.hermes/plans/2026-06-22_141615-llm-first-source-backed-spec-review.md` so deterministic extraction stays the source-backed candidate discovery/cleanup layer, while OpenAI reviews broad meaningful unmatched candidates instead of deterministic confidence deciding final trust.

### Changes

- Reworked `src/lib/ai/spec-candidates.ts`:
  - Added explicit LLM eligibility reasons and `spend_priority`.
  - Removed the old unmatched-row default of `Deterministic classification is sufficiently clear.`
  - Unmatched source-backed rows now default to LLM-eligible after low-information, obvious note/admin noise, existing match/attach, and deterministic source-document skips.
  - Prioritizes model/code systems/fixtures first, then builder-context selections, envelope/structural rows, general finishes, and ordinary review rows.
- Reworked `src/lib/ai/spec-llm.ts`:
  - Sorts eligible candidates by spend priority before applying `OPENAI_SPEC_CLASSIFIER_LIMIT`.
  - Adds `OPENAI_SPEC_CLASSIFIER_BATCH_SIZE` batching and combines sent/accepted/rejected/token diagnostics across batches.
  - Strengthens the prompt so valid-but-incomplete rows are kept in `needs_model_or_code`, `needs_builder_context`, `needs_source_document`, or `general_finish` lanes instead of being rejected as junk.
  - Applies accepted classifications while preserving the broader deterministic `source_snippet` when available and adding both `LLMReviewLane` and `LLMReviewReason` to `extracted_text`.
- Added no-network regression harnesses:
  - `scripts/fixtures/spec-candidate-eligibility-fixtures.json`
  - `scripts/check-spec-candidate-fixtures.mjs`
  - `scripts/fixtures/spec-llm-application-fixtures.json`
  - `scripts/check-spec-llm-application-fixtures.mjs`
  - package scripts `spec-candidates:fixtures` and `spec-llm:fixtures`.
- Expanded API response diagnostics in `src/lib/server/specification-response.ts`:
  - `eligible_by_reason`
  - `skipped_by_reason`
  - `sent_candidate_ids`
  - `accepted_by_lane`
  - `rejected_validation_errors`
- Updated `scripts/smoke-spec-extract-llm.mjs` so it exercises the same ordered/batched `maybeEnhanceSpecificationProposalsWithLlm()` path as the API.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 11 fixtures.
- `npm.cmd run spec-candidates:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-llm:fixtures` passed: 4 fixtures.
- `npm.cmd run spec-extract:smoke` passed against cached Docling artifact: 93 proposals.
- `OPENAI_SPEC_CLASSIFIER_LIMIT=40 OPENAI_SPEC_CLASSIFIER_BATCH_SIZE=20 npm.cmd run spec-extract:llm-smoke` passed:
  - deterministic proposals: 93
  - LLM-eligible candidates: 90
  - sent candidates: 40
  - accepted: 38
  - rejected: 2
  - enhanced proposal count: 92
  - model: `gpt-5.4-mini`
  - token usage: 6,231 input / 4,165 output / 10,396 total
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known Docling/Turbopack NFT tracing warnings.

### Remaining Work

- Browser/Supabase full-flow rerun is still needed: clear or isolate old extracted rows, process `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf` with `DOCUMENT_CONTEXT_PROVIDER=docling_local`, `OPENAI_SPEC_CLASSIFIER_ENABLED=true`, `OPENAI_SPEC_CLASSIFIER_LIMIT=80`, and `OPENAI_SPEC_CLASSIFIER_BATCH_SIZE=20`, then inspect the saved review queue.
- Specific rows to inspect after rerun: `Aluminium window and door joinery`, `Ducted air conditioning`, possible underfloor-heating output if Docling emits it, general finishes, and obvious note/admin suppression.
- Watch LLM lane quality: the 40-candidate smoke accepted 38 and rejected 2 validation-problem outputs, which is useful for recall, but browser review should confirm lanes are practical and not over-promoting rough structural/note-like rows.

## 2026-06-22 - Aluminium Joinery Evidence And LLM Gate Review

### Trigger

After clearing and rerunning the full PDF workflow with `OPENAI_SPEC_CLASSIFIER_LIMIT=120`, the review queue had 96 rows but only 8 showed `LLMReviewReason`. The user asked to inspect what the API got/returned and specifically whether `Aluminium window and door joinery` went through the LLM.

### Findings

- The latest saved upload was `c0b15049-2b38-4320-8d9c-d54a0d8f5000`.
- It saved 96 `extracted_handover_items`; all are unmatched/unverified and in `admin_review`.
- 8 rows showed `LLMReviewReason`, so they were accepted from the OpenAI second pass.
- `Aluminium window and door joinery` did **not** go through the accepted LLM path. Its row had no `LLMReviewReason`.
- Root cause was twofold:
  1. The deterministic extraction rule had an overbroad `/aluminium/` pattern and `Aluminium` evidence term, so it matched an unrelated electrical row: `Brushedaluminiumcoverplatestoallseencoverplates ... external swimming pool pump ...`.
  2. The LLM candidate gate did not include `Joinery`, so this 78-confidence joinery row was considered deterministically clear enough and skipped.
- Because the deterministic source snippet was wrong, simply forcing it through the LLM would not have solved the root issue; the LLM would have seen pump/cover-plate evidence instead of the real window row.

### Changes

- Tightened `Aluminium window and door joinery` extraction in `src/lib/ai/spec-extract.ts`:
  - Removed broad `/aluminium/` and generic `Aluminium` evidence matching.
  - Require window-joinery / external-door-aluminium / translucent-laminate context.
  - Prefer `WindowJoinery`, `Window Joinery`, `translucent laminate`, and selected powdercoat evidence.
- Added regression fixtures:
  - Window joinery uses the actual window row, not aluminium cover plates.
  - Aluminium cover plates alone do not create window joinery.
- Expanded LLM gating in `src/lib/ai/spec-candidates.ts` so unmatched material/envelope categories like joinery, cladding, waterproofing, structural/foundation, and linings can be sent to the classifier when missing clear identifiers.
- Added API diagnostics in `buildSpecificationExtractionResponse()` and server logs for both preview and process endpoints:
  - candidate count
  - needs-LLM count
  - sent count
  - accepted/rejected count
  - token usage

### Verification

- `npm.cmd run spec-extract:fixtures` passed with 11 fixtures.
- `npm.cmd run spec-extract:smoke` passed against cached Docling artifact.
- After the fix, cached-artifact inspection shows `Aluminium window and door joinery` source is the real `Window Joinery ... Aluminium Selected standard powdercoat ... Translucentlaminate...` row.
- Candidate inspection now marks that row as `needs_llm: true` with reason `Potential model/code item without a clear deterministic identifier.`
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT warnings.

### Next test note

The currently saved DB row is still from the pre-fix run. Clear and rerun the PDF to verify the updated API diagnostics and the corrected aluminium window/door joinery source in the review queue.

## 2026-06-22 - Systemic Service Asset Row Extraction

### Trigger

Full-flow review found that page 31 referenced air conditioning, but extraction produced no matching item. The cached Docling markdown had the row as a blank-label, duplicated-value electrical table row:

```txt
2xwire and connection to external airconditioning unit ... air conditioning unit supplied and installed by AirConditioning contractor.
```

The first temptation was a specific `Ducted air conditioning` fallback. That would repeat the one-row patching pattern, so this pass generalized the failure class instead.

### Changes

- Added service/equipment asset recognition in `src/lib/ai/spec-extract.ts` for value-cell driven rows:
  - underfloor heating
  - ducted/air-conditioning units
  - hot water cylinders
  - solar prewire
  - external pump power connections
  - security systems
  - data/network outlets
  - gas fireplaces
- Blank-label/repeated-value Docling table rows are no longer discarded up front. They now survive only when they carry a service/equipment signal; repeated low-value rows still get skipped.
- Title/category inference now uses the service asset matcher before generic label/title fallback, so useful rows can be extracted from value cells even when the first table cell is blank.
- Heating/cooling service rows classify as `needs_model_code` before finish/tile/general rules, so “underfloor heating mat to tiled bathrooms” does not become a generic tile finish row.
- Narrowed the old `Heat pump system` fallback to only `heat pump`/`HVAC` matches; broad `heating`/`cooling` text no longer creates a misleading item.
- Added `buildSpecificationExtractionAudit()` and surfaced it in `npm.cmd run spec-extract:smoke` so future runs show table row count, product-signal row count, extractable row count, and signal rows that were skipped/not represented.

### Regression Coverage

Added fixtures for the class of problem:

- blank repeated service row extracts air conditioning asset generically
- blank repeated service row extracts underfloor heating asset generically

These should catch page-31-style rows without adding one fallback per missed item.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 9 fixtures.
- `npm.cmd run spec-extract:smoke` passed against cached Docling artifact.
  - proposalCount: 93
  - audit tableRowCount: 166
  - audit signalRowCount: 130
  - audit extractableRowCount: 88
  - includes `Ducted air conditioning`, `Hot water cylinder`, `External pump power connection`, and `Solar power prewire`
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

### Follow-up

- The cached Docling markdown does not visibly contain an underfloor-heating row by that phrase, but the new fixture proves the generic extractor will catch a blank/repeated underfloor-heating service row if Docling emits it in the next full run.
- After the next browser full-flow rerun, inspect the extraction audit plus review queue for any remaining `skippedSignalRows` that look handover-relevant.

## 2026-06-22 - OpenAI Second-Pass Spec Classifier

### Goal

Keep Docling/code as the cheap deterministic parser/cleanup layer, then use OpenAI only for compact source-backed candidates that need semantic classification. This keeps the pay-as-you-go model while avoiding sending whole PDFs to the LLM.

### Changes

- Added `src/lib/ai/spec-candidates.ts`.
  - Converts deterministic proposals into `SpecExtractionCandidate` records.
  - Tracks source text, deterministic title/category/action/confidence, and whether the row is worth LLM spend.
  - Skips obvious existing matches, existing tasks, source-document rows, and note/noise rows.
- Added `src/lib/ai/spec-llm.ts`.
  - Uses OpenAI Responses API with strict JSON schema.
  - Requires source-grounded `source_quote` values.
  - Validates candidate IDs, item types, review lanes, source quote grounding, title support, and confidence range.
  - Normalizes LLM confidence returned as `0-1` into `0-100`.
  - Applies accepted classifications back to proposals while preserving deterministic fallback for rejected/low-confidence results.
- Wired optional enhancement into:
  - `src/app/api/specifications/extract-pdf/route.ts`
  - `src/app/api/specifications/process-pdf/route.ts`
- Added script/package command:
  - `scripts/smoke-spec-extract-llm.mjs`
  - `npm.cmd run spec-extract:llm-smoke`

### Runtime Controls

- Deterministic extraction remains the default.
- Set `OPENAI_SPEC_CLASSIFIER_ENABLED=true` to enable the second-pass classifier in app/API extraction routes.
- Set `OPENAI_SPEC_CLASSIFIER_LIMIT=30` or lower/higher to cap candidates sent per extraction.
- Uses `OPENAI_SPEC_CLASSIFIER_MODEL`, falling back to `OPENAI_EXTRACTION_MODEL`, then `gpt-5.1-mini`.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 7 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 90 deterministic proposals.
- `OPENAI_SPEC_CLASSIFIER_LIMIT=6 npm.cmd run spec-extract:llm-smoke` passed.
  - Deterministic proposals: 90
  - LLM-eligible candidates: 73
  - Sent candidates: 6
  - Accepted: 6
  - Rejected: 0
  - Enhanced proposal count: 90
  - Model used in local env: `gpt-5.4-mini`
  - Token usage: 1,171 input / 534 output / 1,705 total
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

### Notes / Next Work

- Current implementation is source-grounded and optional; OpenAI failure logs a warning and falls back to deterministic proposals.
- The next quality step is to tune `needs_llm` gating so only the highest-value ambiguous rows are sent, then run a larger LLM smoke and compare before enabling in production.
- The LLM should remain a classifier/repair stage, not a free-form extractor; Docling/code still own parsing, cleanup, traceability, and fallback behavior.

## 2026-06-22 - Full Docling Rerun and Extraction Output Review

### Goal

Run the real PDF through Docling again, run the fixture/smoke harness, inspect the extraction output, and convert any obvious bad output patterns into systemic fixtures/fixes.

### Commands / Results

- `npm.cmd run docling:smoke:local` passed.
  - PDF: `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf`
  - Docling: 2.104.0
  - Pages: 34
  - Markdown characters: 89,871
  - Tables: 16
  - Elapsed: ~163s
- `npm.cmd run spec-extract:fixtures` passed: 7 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 90 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

### Output Review Findings

The focused extraction review initially found systemic bad patterns that fixtures did not yet cover:

- `Ceramic tile floor finishes` could still choose repeated `FLOOR FINISHES` heading/carpet evidence.
- Generic schema-row duplicates such as `Paint` duplicated the canonical paint proposal.
- `Bathroom&` could become a bogus product title for a GIB ceiling row.
- `Please Note:` electrical-positioning notes could be extracted as a product.
- `Doors tops` was an OCR/readability issue for `Door stops`.

### Fixes

- Added fixtures for repeated floor-heading evidence, generic paint duplicate suppression, bathroom ampersand ceiling rows, and `Please Note:` note-row suppression.
- Enhanced evidence scoring/selection to prefer candidates that also match the extraction rule pattern, not just loose evidence terms.
- Removed `FLOOR FINISHES` as an evidence term for ceramic tile floor finishes because it is a repeated section heading, not source evidence.
- Added OCR normalization for `Door stops`, `mm gibboard`, `gibboard ceilings`, `throughouts`, and split `stopped` artifacts.
- Mapped paint colour-scheme rows and GIB ceiling rows to canonical proposal titles so schema-row duplicates are suppressed by the existing `seen` key.
- Skipped `Please Note:` rows in schema extraction.

### Current Focused Check

The focused review now reports no suspicious matches for the checked patterns: repeated all-caps heading snippets, generic `Paint`, `Bathroom&`, `Please Note:`, or `Doors tops` titles. Key fixture-backed rows now use clean evidence:

- `Interior flush panel doors` -> actual door row.
- `Interior paint finish and colour scheme` -> paint colour scheme row.
- `Ceramic tile floor finishes` -> ceramic tile floor row, not floor-heading/carpet evidence.
- `GIB board ceiling linings` -> GIB ceiling row.
- `Door stops` -> normalized hardware row.

## 2026-06-22 - Systemic Docling Extraction Rework Started

### Goal

Stop fixing individual Docling rows one at a time. Move extraction toward a deployable staged system with fixture coverage for known row classes.

### Changes

- Added a fixture-based regression harness:
  - `scripts/fixtures/spec-extract-row-fixtures.json`
  - `scripts/check-spec-extract-fixtures.mjs`
  - package script: `npm.cmd run spec-extract:fixtures`
- Refactored extraction helpers out of `src/lib/ai/spec-extract.ts` into staged modules:
  - `src/lib/ai/spec-normalize.ts` for OCR/text/table cleanup and cell dedupe.
  - `src/lib/ai/spec-evidence.ts` for evidence matching and scoring.
  - `src/lib/ai/spec-classify.ts` for review lanes and recommended action mapping.
- Updated `scripts/smoke-spec-extract.mjs` so smoke tests transpile the new helper modules as well as `spec-extract.ts`.
- Current fixtures cover:
  - interior flush panel doors must use the real door row instead of repeated headings.
  - Builder's-range tiling must collapse duplicated table cells and become context-before-search.
  - paint colour scheme must be treated as a general finish item and avoid duplicated evidence tails.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 3 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 96 proposals, preserving broad recall.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

### Next Rule

For any future bad extraction row, add a fixture first in `scripts/fixtures/spec-extract-row-fixtures.json`, then change normalization/evidence/classification logic so the fixture passes. Do not patch single titles directly in the main extractor.

## 2026-06-22 - General Finish Items and Door Evidence Cleanup

### Goal

Incorporate review feedback that finish-style items such as tiles, paint, carpet/flooring, and doors often do not need warranty documents. These rows should usually be treated as general builder-reviewed handover context: supplier/range/colour/location/selection matters more than forcing a source-document/manual search.

### Changes

- `getInitialExtractedItemReviewReason()` now gives tiles, paint, flooring/carpet, and doors a general finish review note: confirm supplier/range/colour/location/selection where available; warranty docs may not be required before inclusion.
- Evidence selection now prefers chunks containing higher-priority evidence terms before looser pattern matches, so rule rows do not get captured by repeated section headings.
- Low-information repeated headings such as `INTERIOR DOORS INTERIOR DOORS` are ignored as evidence candidates.
- Short evidence rows are no longer cropped around the matched term, which keeps the full door row visible.
- Added OCR/readability fixes for interior door and paint rows, including `Hollow core`, `flush panel pre-hung doors`, `Semi-gloss paint finish`, `Interior colour scheme`, and paint colour spacing.
- Added repeated-tail cleanup so duplicated Docling table columns collapse in rule-based snippets as well as schema row snippets.

### Verification

- Current `Interior flush panel doors` proposal now uses the actual row: `Doors Type Size Finish Frames Hollow core flush panel pre-hung doors 2200 mm Semi-gloss paint finish 19 mm pine flush jamb for architraves with Semi-gloss paint finish Interior Door Flush Panel`.
- Current paint and wall-tile evidence no longer duplicates the repeated table column.
- Backfilled current Supabase rows for `Interior flush panel doors`, `Interior paint finish and colour scheme`, `Bathroom and wet-area ceramic wall tiles`, and `Garage carpet` with the cleaned evidence and general finish review reason.
- `npm.cmd run spec-extract:smoke` passed: 96 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

## 2026-06-22 - Context Flags and Tiling Row Cleanup

### Goal

Respond to fresh PDF review feedback: context classification should be a flag explaining what the system needs before source search, not a builder-facing "Request context" button. Also clean the duplicated/poorly spaced Docling tiling rows seen in review.

### Changes

- Removed the manual "Request context" button and its unused server action.
- Added non-clickable amber context flags to the builder review queue for:
  - missing brand/model/supplier/code before source search
  - missing quote/manual/warranty/certificate/source document
  - missing builder context before source search
- Added duplicate table-cell cleanup so Docling rows with repeated columns only persist one copy in `extracted_text` and `source_snippet`.
- Stopped stripping the word `Builder` from evidence text so `Builder's range` remains readable.
- Added OCR/readability fixes for Builder's-range tiling phrases, `freestanding`, tiled shower/feature-wall/window-jamb text, punctuation spacing, and comma spacing.
- Prioritized `selected` / `Builder's range` rows into `request_more_context` before falling back to `needs_model_code`.

### Verification

- `npm.cmd run spec-extract:smoke` passed: 96 proposals, preserving recall.
- Spot-check for the reported row now returns title `Wall Tiling- Bathroom(freestanding bath)`, action `request_more_context`, and a single clean source snippet: `Selected ceramic tiles from the Builder's range. All walls tiled floor to ceiling, tiled shower. 1 x tiled feature wall. Tiled into window recess. Tiled into window jamb, sills`.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known Docling/Turbopack NFT tracing warnings.

## 2026-06-22 - Request-More-Context Review Classification

### Goal

Add a first-pass workflow so over-extracted Docling rows are not all just "needs review". Keep recall-first extraction intact while classifying uncertainty into actionable builder/admin follow-up buckets.

### Changes

- `src/lib/ai/spec-extract.ts` now classifies extracted proposals into:
  - `review_new_product`
  - `needs_model_code`
  - `needs_source_document`
  - `request_more_context`
  - existing document/task actions
- Added `getInitialExtractedItemReviewReason()` so inserted rows carry clear reviewer notes such as "Request model/code", "Request source document", or "Request more context".
- Added optional enum statuses in code/docs for `request_more_context`, `needs_source_document`, and `needs_model_code`.
- Added `docs/supabase-add-extracted-item-context-statuses.sql` for the enum migration.
- `/api/specifications/process-pdf` now attempts the richer statuses, but falls back to `admin_review` plus the explicit review note if the database enum has not been migrated yet.
- Builder review UI now includes a Context requests metric and non-clickable context flags that explain what is missing before source search.
- Builder dashboard/product awaiting counts include the new context-request statuses.

### Verification

- Pushed implementation commit `e52e623` to `codex/docling-local-context`.
- `npm.cmd run spec-extract:smoke` passed: 96 proposals, preserving the current broad recall.
- Action breakdown from the smoke artifact: 50 standard product review, 25 needs model/code, 8 request more context, 7 needs source document, 2 request document, 3 manual review, 1 attach existing task.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known local Docling/Turbopack NFT tracing warnings.

### Data Backfill

- Latest full Docling upload `96386625-c705-4895-9f89-40c09a899d04` was backfilled by title where possible.
- 75 of 100 rows matched the current proposal titles and had review notes refreshed.
- Current visible review-note grouping on that upload: 68 standard review, 9 needs source document, 16 needs model/code, 7 request more context.
- The DB enum migration could not be applied from this machine because direct Supabase Postgres access on port 5432 was blocked, so backfill used `admin_review` status with explicit review notes.

### Remaining Work

- Apply `docs/supabase-add-extracted-item-context-statuses.sql` from an environment with direct Supabase DB access or via Supabase SQL editor if we want true status values instead of review-note fallback.
- Add dedicated UI filters/tabs for context buckets.
- Add a builder-facing request workflow that creates assignable prompts/tasks rather than just a review note.
- Keep recall-first tuning toward 200-300 possible rows; do not suppress uncertain source-backed candidates just to reduce noise.

## 2026-06-22 - Docling OCR Readability and Title Dedupe Pass

### Goal

Continue the Docling local-first extraction work with slice A from the cloud-Codex prompt: improve OCR/readability normalization and collapse obvious duplicate title variants without making extraction conservative.

### Changes

- Added an OCR phrase-fix table in `src/lib/ai/spec-extract.ts` for recurring Docling/OCR artifacts.
- Applied OCR fixes before and after generic spacing normalization so introduced split-word artifacts can be repaired.
- Added title normalization for extracted row titles.
- Changed proposal de-dupe keys to use compact normalized titles, collapsing obvious case/spacing variants like Garage carpet/Garage Carpet and Grohe kitchen mixer/Grohe Kitchen Mixer.

### Examples Improved

- `Blockworkonfooting` -> `Blockwork on footing`
- `Cavity Slider Hand les` -> `Cavity Slider Handles`
- `To ilet`/`To iletroll` cases now normalize into toilet/toilet-roll titles where matched.
- `Heated To wel Rail` -> `Heated Towel Rail`
- `Gasheating` -> `Gas heating`
- Some source snippets now improve `Internalreticulation`, `Garagecarpetgluefixed`, `irresistiblybeautiful`, and related glued phrases.

### Verification

- Baseline smoke before this pass: 97 proposals.
- After this pass: 96 proposals (90 products, 4 maintenance, 2 documents). The small count drop is from duplicate title collapse, not from conservative filtering.
- `npm.cmd run spec-extract:smoke` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known local Docling/Turbopack NFT tracing warnings.

### Remaining Work

- Continue expanding OCR/readability normalization based on fresh full-workflow rows.
- Add richer `request more context` / `needs source document` workflow instead of all rows being simple `admin_review`.
- Keep recall-first behavior: the spec may have 200-300 potential rows, so do not make extraction conservative merely to reduce noise.
- Later build Azure Content Understanding comparison harness using the same schema as a benchmark only.

## 2026-06-21 - Full Docling Workflow Quality Assessment

### Fresh Run Observed

Full UI upload -> Docling parse -> schema-inspired extraction -> Supabase review queue produced upload `96386625-c705-4895-9f89-40c09a899d04`.

Counts:

- Total rows: 100
- Products: 95
- Maintenance: 3
- Documents: 2
- Status: all `admin_review`
- No rows missing `source_snippet`

Category distribution was strongest in bathroom fixtures, tapware, doors/hardware, flooring, electrical, and tiles. Many rows are genuinely useful and include manufacturer/code/search-query details, especially bathroom fixtures and tapware.

### Quality Issues

- OCR spacing remains the largest quality problem: examples include `Finalpositionsofall`, `Internalreticulation`, `To ilet`, `Hand les`, `squote`, etc.
- Some false positives/generic rows remain: `Please Note:`, `Doors tops`, `Pipe work`, generic `Kitchen`/`Scullery` quote rows, etc.
- Duplicate normalization still needs work: e.g. Garage carpet and Grohe kitchen mixer case variants.
- All rows currently go to `admin_review`; UX needs a separate "request more context" workflow instead of only review/approve/reject.

### Recommendation

Keep refining Docling as the default local-first path for now. The fresh run proves the local pipeline can reach useful breadth without paying a managed extractor for every run. However, run Azure Content Understanding as a benchmark/comparison spike, not an immediate replacement. If Azure is materially better on spacing, item identity, page evidence, and structured fields after using the same schema, then decide whether its quality justifies provider cost/lock-in or whether it should remain an optional paid extraction tier.

### Next Engineering Steps

1. Add OCR/readability normalization pass before persistence.
2. Add duplicate/title normalization.
3. Add false-positive filters for generic note rows.
4. Add "request more context" review action and status.
5. Add an Azure comparison harness using the same schema and same PDF, storing outputs side-by-side for evaluation.

## 2026-06-21 - Azure-Schema-Inspired Table Extraction

### User Feedback

User shared the Azure Context Understanding schema that performed better: exhaustive `Items[]` with item-centric fields including Name, Manufacturer, Supplier, ProductRange, ModelName, ProductCode/SKU, Finish/Colour/Size/Quantity, Category/Location, Description/Notes, HasIdentifier, and SuggestedSearchQuery.

### Implementation

- Kept Docling as the local parser/OCR layer.
- Added schema-inspired extraction from Docling markdown table rows in `src/lib/ai/spec-extract.ts`.
- Table-row candidates now preserve structured detail inside `extracted_text` using fields such as Name, Manufacturer/Supplier, ProductCode, Finish, Size, Category, Location, Description, HasIdentifier, and SuggestedSearchQuery.
- Source snippets are original row text rather than large merged chunks where possible.

### Verification / Data Repair

- `npm.cmd run spec-extract:smoke` now returns 97 proposals from the real Docling artifact.
- Latest upload `f8eb73cd-3359-404f-b708-63d1681df522` was repaired: existing 25 rows updated and 70 missing rows inserted, leaving 95 review rows after de-dupe.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known local Docling Turbopack NFT warnings.

### Caution / Next Tuning

This is a deterministic schema-inspired extractor, not Azure semantic extraction yet. It is intentionally more exhaustive and will include noisy/generic rows. Next pass should tune false positives, improve title generation, and map the structured fields to first-class DB columns if the review UI proves useful.

## 2026-06-21 - Table-Row Evidence Snippet Tightening

### Issue

The Grohe kitchen mixer row still had source/evidence snippets polluted by adjacent shower-table text and footer OCR such as Builder/Client/quality-home-builder fragments.

### Fix

- Evidence selection now prefers original Docling markdown/table lines before broader merged chunks.
- Evidence cleanup strips Builder/Client footer fragments and other repeated OCR/footer noise.
- Latest upload `f8eb73cd-3359-404f-b708-63d1681df522` was backfilled: 25 rows had `extracted_text` and `source_snippet` regenerated from the tighter evidence selector.

### Verification

- Grohe row now backfills as: `Grohe,Essence Kitchen Mixer with pullout spray-brushed warm sunset 30270 DLO Kitchen Mixer`.
- `npm.cmd run spec-extract:smoke` passed with 28 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known local Docling Turbopack NFT warnings.

### Next Step

Refresh the open edit page and spot-check more rows. If a row still blends adjacent table cells, tune its specific rule/evidenceTerms or add table-cell extraction instead of chunk fallback.

## 2026-06-21 - Source Snippet Persistence Fix

### Issue

After the broader Docling extraction run, about 25 rows were inserted, but review edit pages still warned that no source snippet was attached. The form displayed fallback `extracted_text` in the source snippet textarea, while the database `source_snippet` column was null. Evidence snippets also included Docling image/comment artifacts such as `<!-- image -->`.

### Fix

- `ProposedSpecItem` now carries `source_snippet` and `source_page` fields.
- `src/lib/ai/spec-extract.ts` now strips Docling image/comment artifacts before saving evidence text/snippets.
- `/api/specifications/process-pdf` now persists `source_snippet` and `source_page` when inserting `extracted_handover_items`.
- Latest upload `b13c6801-6a3d-4100-85ca-b43d149b6e59` was backfilled: 25 existing rows updated with generated source snippets.

### Verification

- `npm.cmd run spec-extract:smoke` passed with 27 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known local Docling Turbopack NFT warnings.

### Next Step

Refresh the current review edit page. The yellow "No source snippet" warning should disappear for backfilled rows. Snippet readability is improved but still limited by OCR spacing; further tuning should focus on cleaner source chunking/page attribution.

## 2026-06-21 - Broader Docling Extraction Push Completed

### Push

- Branch: `codex/docling-local-context`
- Implementation commit: `214872f`
- Commit message: `feat: broaden Docling spec extraction`

### Current Ground Truth

The app previously completed Docling parse/upload but inserted only 5 rows because `src/lib/ai/spec-extract.ts` was too narrow. That function now emits 27 proposals from the real Docling markdown smoke artifact while keeping the workflow contract unchanged.

### Next Step

Restart or refresh the local dev app, reprocess the same PDF through `/builder/specifications/new`, then inspect `/builder/specifications/review`. Expect a new upload to create about 27 rows; compare quality/noise before tuning further.

## 2026-06-21 - Docling-Aware Extraction Breadth Implemented

### What Changed

- Replaced the tiny keyword-only `buildSpecificationProposals()` stub with a broader deterministic extractor that normalizes Docling markdown, chunks evidence, applies product/maintenance/document rules, deduplicates rows, and preserves source snippets.
- Added `scripts/smoke-spec-extract.mjs` plus `npm.cmd run spec-extract:smoke` to test proposal breadth against the local Docling markdown artifact without re-running Docling.
- Kept the existing review workflow contract and status behavior: known maintenance matches can auto-approve, while most new/uncertain product rows remain review/source-gap candidates.

### Verification

- `npm.cmd run spec-extract:smoke` passed against `.local-artifacts/docling/2074-legal-signed-outline-spec.md`.
- Smoke output: 27 proposals total: 21 product, 4 maintenance, 2 document.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known local Docling Turbopack NFT warnings.

### Next Task

Restart/reload the dev server and process the PDF again through `/builder/specifications/new`. The new upload should insert about 27 review rows instead of the previous 5; then inspect `/builder/specifications/review` for row quality/noise and tune the rule list.

## 2026-06-21 - Docling Parse Complete, Extraction Breadth Bottleneck

### Evidence

- The real scanned spec upload completed and inserted a `specification_uploads` row.
- Latest upload `1a05e070-a4e2-46bf-9aea-142e4b6cae68` produced exactly 5 `extracted_handover_items`.
- Process inspection showed no active Docling child process; parsing was finished, not still running.
- Inserted items were limited to the existing canned keyword outputs: Linea Weatherboard, gutters/downpipes cleaning, exterior cladding washing, kitchen appliances, and heat pump system.

### Root Cause

The parser is no longer the main bottleneck. The current proposal builder in `src/lib/ai/spec-extract.ts` is still a small deterministic stub that only emits a handful of canned rows when keywords are present.

### Active Next Task

Build a broader Docling-aware deterministic extractor that chunks/labels Docling markdown and creates more source-grounded proposal rows while keeping admin-noise and source-gap guardrails strict. Local plan saved at `.hermes/plans/2026-06-21_204900-docling-extraction-breadth.md`.

## 2026-06-21 - Specification Process Storage Upload Fix

### What Changed

- Updated `/api/specifications/process-pdf` so the storage upload uses the server-only Supabase service-role client when `SUPABASE_SERVICE_ROLE_KEY` is available.
- Kept authenticated user checks and normal row inserts on the request/session Supabase client.
- Added server logging and a `detail` field for storage upload failures so future upload errors are diagnosable instead of only showing `Could not upload specification PDF.`
- Updated the upload panel to surface the returned storage detail in the inline error when an upload still fails.

### Why

The Docling parse completed far enough to reach the Supabase storage upload, but the browser received `Could not upload specification PDF.` The local app already has the private `handover-documents` bucket and service role configured; using the server-only service role for bucket writes avoids client/RLS storage policy friction during the local workflow while keeping secrets server-side.

### Checks Run

- `npm.cmd run document-context:readiness` - passed.
- `npm.cmd run supabase:smoke:readiness` - passed; private `handover-documents` bucket reachable.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed, with known local Docling Turbopack NFT tracing warnings.

### Next Task

Restart `npm.cmd run dev:docling`, hard-refresh the app, upload the PDF again, and wait for the Docling process. If it still fails, the inline error should now include the Supabase storage detail and the terminal should log the bucket/path/error.

## 2026-06-21 - HMR Origin And File Input Resync

### What Changed

- Added `allowedDevOrigins` for `127.0.0.1` and `localhost` in `next.config.ts` to stop the local HMR websocket from being blocked when the browser and dev server hostnames differ.
- Added a mount-time native file-input resync in `SpecExtractPanel` so a selected browser file is copied back into React state after Fast Refresh/HMR preserves the input control but resets component state.

### Why

The user saw `WebSocket connection to ws://127.0.0.1:3000/_next/webpack-hmr failed` and the screenshot showed the native file chooser had a PDF while the app status still said `No PDF selected`. That is consistent with dev HMR/origin trouble plus native file input state surviving while React state reset.

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed, with known local Docling Turbopack NFT tracing warnings.

### Next Task

Restart the dev server because `next.config.ts` changed, open one canonical URL (`http://localhost:3000` or `http://127.0.0.1:3000`, not both), hard-refresh, select the PDF again, and click `Process to review`.

## 2026-06-21 - Spec Upload Button UX Fix

### What Changed

- Made the `Process to review` and `Preview PDF only` buttons clickable whenever the panel is not already processing.
- Added a ref-backed file lookup so the handler can read the native file input even if React state and the browser file chooser display get out of sync.
- Added both `onChange` and `onInput` handling for the specification PDF input.
- Verified the Projects `Add new project` modal opens in-browser while signed in as the documented test account.

### Why

The user selected the real spec PDF and the native input showed the filename, but `Process to review` still appeared greyed out. This indicates the browser input UI and React `selectedPdf` state could get out of sync. The button now validates on click instead of being permanently blocked by stale state.

### Checks Run

- Browser check: `/builder/specifications/new` now shows `Process to review` enabled; clicking without a file shows `Choose a PDF first.`
- Browser check: `/builder/projects` `Add new project` opens the project modal.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed, with the known Turbopack NFT tracing warnings around local Docling child-process support.

### Next Task

Ask the user to refresh `/builder/specifications/new`, select the real spec PDF again, and click `Process to review`. If processing starts, wait several minutes for Docling. If it fails, capture the inline error and server log.

## 2026-06-21 - Windows PowerShell Docling Dev Command Fix

### What Changed

- Added `npm.cmd run dev:docling` so Windows PowerShell users do not need POSIX-style inline environment variable syntax.
- Updated worksheet/phased-work/handoff docs to prefer the Windows-friendly command.

### Why

PowerShell rejected `DOCUMENT_CONTEXT_PROVIDER=docling_local npm.cmd run dev` because that syntax is for POSIX shells, not PowerShell.

### Next Command

```powershell
npm.cmd run dev:docling
```

Alternative:

```powershell
$env:DOCUMENT_CONTEXT_PROVIDER="docling_local"; npm.cmd run dev
```

## 2026-06-21 - Docling Local Parser Implementation Push Completed

### What Changed

- Pushed the local Docling parser spike and `docling_local` provider wiring to GitHub.
- Branch: `codex/docling-local-context`.
- Commit pushed: `1a79f03`.
- Left `.local-artifacts/docling/` ignored and uncommitted. Left local `.codex/` and `.hermes/` untracked and uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except untracked local agent folders.

### Unknowns/Risks

- Browser upload smoke has not yet been run with `DOCUMENT_CONTEXT_PROVIDER=docling_local`.
- Turbopack build currently passes with NFT tracing warnings around local Docling child-process support.

### Suggested Next Task

Run the app with `npm.cmd run dev:docling` from Windows PowerShell (or `$env:DOCUMENT_CONTEXT_PROVIDER="docling_local"; npm.cmd run dev`), upload the real scanned outline spec through the builder specification flow, and verify extraction diagnostics/review queue quality before tuning prompts or moving toward a VPS Docling service.

## 2026-06-21 - Docling Local Parser Smoke Implemented

### What Changed

- Added `.local-artifacts/` to `.gitignore` for local parser outputs.
- Added `scripts/docling-convert.py`, a local Docling conversion CLI that writes markdown, JSON, and diagnostics artifacts.
- Added `scripts/smoke-docling-local.mjs` and `npm.cmd run docling:smoke:local` for the real scanned spec smoke.
- Installed `docling==2.104.0` in the local Hermes Python environment only; no Python environment files were committed.
- Extended document-context provider types/readiness to support `docling_local` and `docling_http` provider names while keeping LlamaCloud intact.
- Wired `DOCUMENT_CONTEXT_PROVIDER=docling_local` into `extractDocumentContext()` with fallback to `local_pdf` if Docling fails.
- Updated Docling plan/phased-work/worksheet docs with the local parse result.

### Files Changed

- `.gitignore`
- `package.json`
- `scripts/docling-convert.py`
- `scripts/smoke-docling-local.mjs`
- `scripts/check-document-context-readiness.mjs`
- `src/lib/server/docling.ts`
- `src/lib/server/document-context.ts`
- `src/lib/server/document-context-readiness.ts`
- `src/lib/server/specification-response.ts`
- `docs/docling-local-context-plan.md`
- `docs/docling-phased-work.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `python -m pip show docling` - passed; local Hermes Python has `docling 2.104.0`.
- `npm.cmd run docling:smoke:local` - passed; warm run parsed 34 pages into 89,871 markdown characters and 16 table-like structures in 167.537 seconds.
- `npm.cmd run document-context:readiness` - passed; default remains `local_pdf`.
- `DOCUMENT_CONTEXT_PROVIDER=docling_local npm.cmd run document-context:readiness` - passed; reports `selectedProvider: docling_local` and `willUseDocling: true`.
- `npm.cmd run supabase:smoke:readiness` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed. Turbopack emitted NFT tracing warnings for the local Docling child-process path; this is acceptable for the local spike but should be addressed before Cloudflare/OpenNext deployment.

### Unknowns/Risks

- The actual browser upload workflow has not yet been run with `DOCUMENT_CONTEXT_PROVIDER=docling_local`.
- Docling output is much richer than plain pdf-parse but still has OCR spacing/word-join artifacts, so extraction prompt/normalization may need tuning after the browser smoke.
- CPU parse time is a few minutes for the 34-page scanned PDF; future VPS sizing and caching need consideration.
- Turbopack tracing warnings around local Docling should be revisited before production hosting.

### Suggested Next Task

Set `DOCUMENT_CONTEXT_PROVIDER=docling_local`, start the app, upload the real scanned outline spec through `/builder/specifications/new`, and verify that extraction diagnostics show Docling without fallback and that the review queue contains useful homeowner-relevant rows while admin/source-gap guardrails still hold.

## 2026-06-21 - Docling Planning Branch Push Completed

### What Changed

- Pushed Docling local-context planning work to GitHub.
- Branch: `codex/docling-local-context`.
- Commit pushed: `8565528`.
- Left local `.codex/` and `.hermes/` untracked and uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push -u origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except untracked local agent folders.

### Unknowns/Risks

- Docling is still a plan only; it has not been installed or run against the real scanned PDF yet.

### Suggested Next Task

Implement Phase D1 from `docs/docling-phased-work.md`: install/run Docling locally, create `scripts/docling-convert.py`, process the real scanned spec, and inspect ignored artifacts under `.local-artifacts/docling/` before wiring `DOCUMENT_CONTEXT_PROVIDER=docling_local`.

## 2026-06-21 - Docling Local Parser Spike Planned

### What Changed

- Created a new feature branch direction for Docling: `codex/docling-local-context`.
- Added a local-first Docling parser plan at `docs/docling-local-context-plan.md`.
- Added detailed Docling phased work at `docs/docling-phased-work.md`.
- Updated `docs/phased-work.md`, `docs/architecture.md`, and `WORKSHEET.md` so future agents know Docling is the next active parser spike while LlamaCloud remains available for later comparison.
- The plan intentionally starts with local Docling testing against the real scanned outline spec before adding VPS, Cloudflare Container, Azure, or LlamaCloud dependency.

### Files Changed

- `docs/docling-local-context-plan.md`
- `docs/docling-phased-work.md`
- `docs/phased-work.md`
- `docs/architecture.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Planning/docs-only change. Lightweight validation should check conflict markers and git status before push.

### Unknowns/Risks

- Docling is not installed or tested yet in this entry.
- The real scanned PDF still needs a local Docling parse quality test.
- Future VPS hosting is plausible but intentionally deferred until local parse quality and resource usage are known.
- LlamaCloud should not be removed; it remains an optional future quality comparison provider.

### Suggested Next Task

Install/run Docling locally, create `scripts/docling-convert.py`, process `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf`, save ignored artifacts under `.local-artifacts/docling/`, then decide whether to wire `DOCUMENT_CONTEXT_PROVIDER=docling_local` into the app.

## 2026-06-21 - Phone Codex Cloud Consolidation Push Completed

### What Changed

- Pushed the consolidated phone/Codex cloud work to GitHub.
- Commit pushed: `e3bfe66` on branch `codex/llamacloud-greenfield`.
- Left local `.codex/` and `.hermes/` untracked and uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except untracked local agent folders.

### Unknowns/Risks

- `LLAMA_CLOUD_API_KEY` still needs to be configured locally before realistic scanned-PDF extraction.
- Full browser workflow smoke remains the next active task.

### Suggested Next Task

Add the LlamaCloud API key to local `.env.local` only, run `npm.cmd run document-context:readiness`, then run the full Supabase-mode workflow smoke with the real scanned outline spec.

## 2026-06-21 - Phone Codex Cloud Consolidation Anchored

### What Changed

- Fetched and consolidated the four new Codex cloud/mobile branches into `codex/llamacloud-greenfield`:
  - `be5640b` docs: Cloudflare-first Next.js deployment plan.
  - `8f57b8a` LlamaCloud/document-context readiness check.
  - `43aad2a` extraction admin-noise guardrails.
  - `8f3f1db` quote/source-gap approval and publish-readiness hardening.
- Resolved worksheet/handoff-log conflicts by keeping all relevant cloud entries and updating the current next-work plan.
- Updated `docs/architecture.md` so the app host target is Cloudflare Workers/Pages with OpenNext, with Vercel only as fallback for a documented blocker.
- Anchored the next work around LlamaCloud configuration and a full Supabase-mode browser/user workflow test.

### Files Changed

- `HANDOFF.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`
- `docs/architecture.md`
- `docs/cloudflare-nextjs-deployment-plan.md`
- `docs/context-first-extraction-and-source-gap-strategy.md`
- `docs/llamacloud-greenfield-implementation.md`
- `package.json`
- `scripts/check-document-context-readiness.mjs`
- `src/app/api/specifications/document-context-readiness/route.ts`
- `src/lib/ai/extraction-guardrails.ts`
- `src/lib/ai/outline-spec-normalize.ts`
- `src/lib/ai/spec-extract.ts`
- `src/lib/extraction/outline-spec-schema.ts`
- `src/lib/server/actions.ts`
- `src/lib/server/document-context-readiness.ts`
- `src/lib/server/document-context.ts`
- `src/lib/server/document-extraction.ts`
- `src/lib/workflow-readiness.ts`

### Checks Run

- `npm.cmd run document-context:readiness` - passed; currently reports `local_pdf` fallback because `LLAMA_CLOUD_API_KEY` is not configured locally yet.
- `npm.cmd run supabase:smoke:readiness` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed locally.

### Current Plan

1. Add `LLAMA_CLOUD_API_KEY` locally and set `DOCUMENT_CONTEXT_PROVIDER=llamacloud` for the realistic extraction pass.
2. Run `npm.cmd run document-context:readiness` and confirm it reports LlamaCloud will be used without printing the key.
3. Run the real scanned outline spec through the app and confirm LlamaCloud-backed extraction quality plus admin-noise guardrails.
4. Run the full Supabase-mode browser workflow: login, workspace/project, upload, extraction/review, source-gap/builder-supplied/supporting evidence, publish readiness, publish, and client portal visibility.
5. Fix only blockers found in that workflow, then revisit Cloudflare/OpenNext app deploy implementation.

### Unknowns/Risks

- LlamaCloud API key is still not configured locally in this anchored state, so realistic scanned-PDF extraction is not proven yet.
- Browser-level workflow smoke has not run after the merge.
- OpenNext/Cloudflare app hosting is planned but not configured yet.

### Suggested Next Task

Configure LlamaCloud locally, confirm document-context readiness, and start the full Supabase-mode workflow smoke with the real scanned outline spec.

## 2026-06-21 - Quote Source-Gap Approval Guard

### What Changed

- Loaded quote-reference status and raw extraction metadata in the Supabase approve-as-correct guard so server-side source-gap checks use the same signals as the UI/local path.
- Kept publish readiness strict for rows that somehow became `approved` while still carrying unresolved quote references, missing fields, or builder-info prompts.
- Added explicit pending-resolution metadata to supporting evidence uploads so quote/evidence attachment is auditable without pretending the item is automatically resolved.
- Updated the worksheet and handoff notes with the current behavior.

### Files Changed

- `src/lib/server/actions.ts`
- `src/lib/workflow-readiness.ts`
- `HANDOFF.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm run lint` - passed in Codex cloud.
- `npm run supabase:smoke:readiness` - failed in Codex cloud because Supabase secrets were not configured there.
- `npm run build` - failed in Codex cloud because Next.js could not fetch Google-hosted Geist fonts from that environment.
- `npx tsc --noEmit` - passed in Codex cloud.

### Unknowns/Risks

- Supabase-mode smoke still needs an environment with Supabase URL, anon key, and service-role key.
- Full Next build should be rerun locally where Google Fonts can be fetched or after switching to local fonts.
- Browser smoke for edit/evidence/builder-supplied resolution paths remains a follow-up.

### Suggested Next Task

Run the Supabase-mode browser smoke with secrets available, then verify that quote-like source gaps cannot be approved as correct, supporting evidence creates an audit action, edited or builder-supplied rows can proceed, and publish remains blocked for unresolved approved-as-correct gaps.

## 2026-06-21 - LlamaCloud Readiness Check

### What Changed

- Added a secret-safe document-context readiness helper and API route that reports whether uploads will use LlamaCloud Parse or local PDF/OCR fallback without printing `LLAMA_CLOUD_API_KEY`.
- Added `npm.cmd run document-context:readiness` for local/cloud checklist verification of provider selection.
- Updated LlamaCloud implementation docs and the worksheet with canonical `LLAMA_CLOUD_API_KEY` setup and fallback behavior.

### Files Changed

- `src/lib/server/document-context-readiness.ts`
- `src/lib/server/document-context.ts`
- `src/app/api/specifications/document-context-readiness/route.ts`
- `scripts/check-document-context-readiness.mjs`
- `package.json`
- `docs/llamacloud-greenfield-implementation.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm run document-context:readiness` - passed and reported local fallback because no LlamaCloud key was present in Codex cloud.
- `DOCUMENT_CONTEXT_PROVIDER=llamacloud LLAMA_CLOUD_API_KEY=<redacted> npm run document-context:readiness` - passed and confirmed the command reports `llamacloud_parse` without printing the key.
- `npm run lint` - passed in Codex cloud.
- `npm run build` - failed in Codex cloud because Next.js could not fetch Google-hosted Geist fonts during the production build.

### Unknowns/Risks

- No real LlamaCloud parse was run because Codex cloud did not expose a `LLAMA_CLOUD_API_KEY` or the real scanned PDF.
- The readiness check proves provider selection only; a real OCR-quality smoke still needs a configured key and representative PDF.

### Suggested Next Task

Configure `LLAMA_CLOUD_API_KEY` in a local or cloud secret store, run `npm.cmd run document-context:readiness`, then process a representative scanned specification PDF and confirm extraction diagnostics show `provider: llamacloud_parse` before continuing source-search work.

## 2026-06-21 - Consolidation Push Completed

### What Changed

- Pushed the consolidated Supabase readiness smoke and source-gap/publish-readiness hardening work to GitHub.
- Commit pushed: `9d8ff14` on branch `codex/llamacloud-greenfield`.
- Left local `.codex/` untracked and uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except existing untracked `.codex/`.

### Unknowns/Risks

- Browser-level Supabase smoke remains the next step.
- LlamaCloud/OCR remains needed for realistic scanned-PDF extraction.

### Suggested Next Task

Run the app locally in Supabase mode and complete the browser smoke from `docs/hunter-testing-checklist.md`, starting with `npm.cmd run supabase:smoke:readiness`, then magic-link login/workspace bootstrap/upload/review/publish-readiness checks.
## 2026-06-21 - Cloud Branch Consolidation: Supabase Smoke And Source-Gap Readiness

### What Changed

- Fetched Codex cloud branches and selectively consolidated the safest changes into `codex/llamacloud-greenfield`.
- Added `scripts/smoke-supabase-readiness.mjs` and `npm.cmd run supabase:smoke:readiness` for a secret-safe Supabase readiness check.
- Updated the hunter testing checklist to run the Supabase readiness smoke before browser testing.
- Ported source-gap publish/readiness hardening from the Codex cloud branch: unresolved quote references, missing fields, and builder-info prompts block normal “Approve as correct”.
- Added a builder-supplied review form that requires notes explaining the project-specific source/quote/site decision/builder knowledge.
- Adjusted the source-gap helper typing so both full UI workflow items and minimal server review items can be checked safely.

### Files Changed

- `package.json`
- `scripts/smoke-supabase-readiness.mjs`
- `docs/hunter-testing-checklist.md`
- `src/lib/workflow-readiness.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run supabase:smoke:readiness` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- Browser-level Supabase smoke is still the next step; this pass verified build/readiness but did not click through magic-link login or upload flows.
- The real outline spec PDF remains scanned/image-heavy, so LlamaCloud/OCR is still needed for realistic extraction quality.
- Other cloud branches added overlapping smoke scripts and extraction/admin-noise guardrails; these were reviewed but not all merged blindly. Extraction guardrails should be considered in a follow-up after the app smoke test.

### Suggested Next Task

Run the Supabase-mode browser smoke: sign in, confirm builder workspace bootstrap, upload a demo asset or the real PDF when LlamaCloud is ready, verify extraction/review queue creation, test builder-supplied/source-gap paths, and confirm publish-readiness blocks unsafe handover publication.
## 2026-06-21 - Bedtime Codex Cloud Handoff Prompt

### What Changed

- Added a copy/paste prompt to `WORKSHEET.md` for running one final Codex cloud/mobile command from the phone.
- The prompt tells the cloud agent what to read first, what Supabase setup was completed locally, what secrets may be missing in cloud, and what the next best smoke-test task is.
- Clarified that local-only files like the scanned PDF may not be available to Codex cloud unless uploaded or present in the repo.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Documentation-only update; no app checks required.

### Unknowns/Risks

- Codex cloud will only have access to pushed repo files and any cloud-configured secrets, not this local machine after it is powered off.
- LlamaCloud is still not configured, so scanned-PDF extraction remains a future realistic-testing dependency.

### Suggested Next Task

From phone/Codex cloud, use the prompt in `WORKSHEET.md` to prepare or run the Supabase-mode smoke test, depending on cloud secret availability.
## 2026-06-21 - Supabase Migration Setup Push Completed

### What Changed

- Pushed Supabase migration/setup documentation and Supabase agent skills to GitHub on branch `codex/llamacloud-greenfield`.
- Commit pushed: `9332619`.
- Left `.env.local` and `.codex/` uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except existing untracked `.codex/`.

### Unknowns/Risks

- This entry records the push; app/browser smoke tests still need to be run separately.

### Suggested Next Task

Run the app in Supabase mode and test magic-link login, builder workspace bootstrap, document upload, extraction/review queue creation, and publish-readiness behavior.
## 2026-06-21 - Supabase Migrations Applied And Agent Skills Installed

### What Changed

- Added the direct Supabase Postgres connection string to local `.env.local` only; no secrets were committed.
- Installed Supabase agent skills with `npx skills add supabase/agent-skills --yes`, adding `.agents/skills/supabase`, `.agents/skills/supabase-postgres-best-practices`, and `skills-lock.json` for compatible agents.
- Applied every repo migration file matching `docs/supabase-add-*.sql` to the Supabase database.
- Verified previously missing workflow/billing/event tables are now available through both direct Postgres checks and Supabase REST.

### Migration Files Applied

- `docs/supabase-add-document-workflow-phase1.sql`
- `docs/supabase-add-builder-workspace-bootstrap.sql`
- `docs/supabase-add-client-extracted-items-policy.sql`
- `docs/supabase-add-client-invite-acceptance.sql`
- `docs/supabase-add-document-download-events.sql`
- `docs/supabase-add-extracted-item-review-reason.sql`
- `docs/supabase-add-extraction-usage-metrics.sql`
- `docs/supabase-add-handover-approvals.sql`
- `docs/supabase-add-handover-open-events.sql`
- `docs/supabase-add-maintenance-completion-policies.sql`
- `docs/supabase-add-organisation-update-policy.sql`
- `docs/supabase-add-project-credits-stripe.sql`

### Files Changed

- `.env.local` locally only, ignored by git
- `.agents/skills/supabase/**`
- `.agents/skills/supabase-postgres-best-practices/**`
- `skills-lock.json`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Direct Postgres connection check as `postgres` - passed.
- Applied all listed migration files - passed.
- Direct database table verification - passed for `uploaded_documents`, `document_extraction_jobs`, `project_credit_accounts`, `project_credit_events`, `handover_open_events`, `document_download_events`, `handover_approvals`, and related workflow types/RPCs.
- Supabase REST verification - passed for `uploaded_documents`, `document_extraction_jobs`, `project_credit_events`, `handover_open_events`, `document_download_events`, and `handover_approvals`.
- Supabase Storage bucket check for `handover-documents` - passed.

### Unknowns/Risks

- Magic-link login itself still needs a browser/app smoke test.
- The provided outline spec PDF is scanned/image-heavy, so realistic extraction still needs LlamaCloud or another OCR-capable path.
- `.codex/` remains untracked and was not committed.

### Suggested Next Task

Run the app in Supabase mode and perform an end-to-end smoke test: magic-link login, builder workspace bootstrap, project/spec upload using the provided PDF, extraction/review queue creation, and publish-readiness behavior.
## 2026-06-21 - Documentation Push Completed

### What Changed

- Pushed the cross-agent worksheet and setup-status documentation to GitHub on branch `codex/llamacloud-greenfield`.
- Commit pushed: `ead6510`.
- Left `.env.local` and `.codex/` uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except existing untracked `.codex/`.

### Unknowns/Risks

- This entry records the push; it does not apply pending Supabase SQL migrations.

### Suggested Next Task

Apply missing Supabase add-migrations with DB migration access, then run a Supabase-mode upload/review smoke test using the provided scanned outline spec PDF and LlamaCloud/OCR-capable parsing when available.
## 2026-06-21 - Supabase Local Environment And Storage Check

### What Changed

- Added the Supabase service role key to local `.env.local` only; no secrets were committed.
- Verified service-role REST access to the configured Supabase project.
- Created/confirmed the private `handover-documents` storage bucket required by the app.
- Documented that an older `handover_documents` bucket also exists, but the app code uses `handover-documents`.
- Recorded current Supabase readiness in `WORKSHEET.md`.

### Files Changed

- `.env.local` locally only, ignored by git
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Queried representative REST tables with the service-role key.
- Listed Supabase storage buckets and created/confirmed `handover-documents`.
- Confirmed `organisations`, `organisation_members`, `projects`, and `extracted_handover_items` are reachable.

### Unknowns/Risks

- Several later migration tables were not found through PostgREST: `uploaded_documents`, `document_extraction_jobs`, `project_credit_events`, and `handover_open_events`. Full Supabase-mode testing needs the relevant `docs/supabase-add-*.sql` migrations applied.
- Applying SQL migrations still needs database-owner access, a Supabase access token/project link, or the database password; the service role JWT is enough for app/server API access but not enough for arbitrary SQL migration execution through the standard REST API.
- Magic-link configuration was reported by the user but not verified through the dashboard/API in this pass.
- The provided outline spec PDF is likely scanned/image-heavy: `pdf-parse` saw 34 pages but only about 957 text characters, so LlamaCloud or OCR-capable processing is important for realistic extraction testing.

### Suggested Next Task

Apply the pending `docs/supabase-add-*.sql` migrations through the Supabase SQL editor or provide database migration access, then run a real Supabase-mode upload/review smoke test with the provided outline spec PDF.

## 2026-06-21 - Cross-Agent Ground Truth And Push Handoff Rules

### What Changed

- Confirmed the active local project is `C:\Users\hunte\OneDrive\Desktop\TestWebApp`.
- Verified the repository remote points to `https://github.com/GeorgePersson/builder-handover-portal.git` and the active branch is `codex/llamacloud-greenfield`.
- Added explicit cross-agent ground-truth rules so Hermes, local Codex, Codex cloud/mobile, and future agents read the same required docs before changing the project.
- Added a push discipline: before `git push`, provide a detailed explanation of the work, checks, risks, and follow-ups; after pushing, update the worksheet and handoff log.
- Created `WORKSHEET.md` as the simple live tracker for done/next work.

### Files Changed

- `AGENTS.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Verified `git ls-remote --heads origin` succeeded for the GitHub remote.
- Verified global git identity is configured as `George Persson <129338143+GeorgePersson@users.noreply.github.com>`.
- No app build/lint needed because this was documentation-only.

### Unknowns/Risks

- GitHub CLI (`gh`) is not installed in this environment, so GitHub API/PR tasks will use plain `git`/HTTPS unless `gh` is installed later.
- No push was performed for this documentation update yet.

### Suggested Next Task

Use this prompt from local or cloud Codex:

```txt
Continue the Builder Handover Portal from C:\Users\hunte\OneDrive\Desktop\TestWebApp. Read AGENTS.md, HANDOFF.md, WORKSHEET.md, docs/product-brief.md, docs/phased-work.md, and docs/architecture.md first. Follow the worksheet and update it plus docs/agent-handoff-log.md after meaningful work.
```

## 2026-06-20 - Project Memory Documentation Setup

### What Changed

- Expanded `AGENTS.md` from only the Next.js warning into practical operating rules for future agents.
- Added stable project-memory entrypoint docs under `docs/`.
- Linked the new docs to the existing deeper architecture, phase, workflow, and handoff documents instead of replacing them.

### Files Changed

- `AGENTS.md`
- `docs/product-brief.md`
- `docs/phased-work.md`
- `docs/architecture.md`
- `docs/database-schema.md`
- `docs/domain-glossary.md`
- `docs/ux-rules.md`
- `docs/decisions.md`
- `docs/known-issues.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- Existing worktree had unrelated modified app/schema files before these docs were edited; this handoff entry does not claim ownership of those changes.
- README may still lag behind the current handoff/workflow docs.
- Cloudflare pipeline and Azure/LlamaCloud document context behaviour should be verified against current env/config before future implementation work.

### Suggested Next Task

Continue from `HANDOFF.md` and `docs/phased-work.md`. A good next prompt is:

```txt
Continue the Builder Handover Portal from C:\Users\hunte\OneDrive\Desktop\TestWebApp. Read HANDOFF.md, AGENTS.md, docs/product-brief.md, docs/phased-work.md, and docs/architecture.md first. Then pick up the next best work without changing the product direction.
```

## 2026-06-20 - Phase 3 Readiness And Docs Alignment

### What Changed

- Confirmed the next active implementation lane as Phase 3 builder review/edit hardening.
- Tightened workflow publish readiness so unresolved quote references, missing source details, or builder-context prompts block publish until resolved or explicitly reviewed.
- Replaced visible implementation-note copy in the builder review edit card with builder-facing review guidance.
- Clarified the docs front door: stable entrypoints remain `product-brief`, `phased-work`, and `architecture`; `greenfield-build-plan` is required for clean-start/rebuild planning; LlamaCloud is the preferred current path when configured, not a hard-coded provider.

### Files Changed

- `AGENTS.md`
- `HANDOFF.md`
- `docs/known-issues.md`
- `docs/agent-handoff-log.md`
- `src/components/builder/projects-workspace.tsx`
- `src/lib/workflow-readiness.ts`

### Checks Run

- `npm.cmd run lint` - passed.

### Unknowns/Risks

- Browser upload smoke for `/builder/projects` is still a manual follow-up because file attachment automation has been unreliable in this environment.
- Existing worktree changes from earlier slices are still present and should be treated as part of the broader branch state, not reverted.

## 2026-06-20 - Cloudflare Local R2 Smoke

### What Changed

- Added a dry-run Worker `/cache/smoke` endpoint that writes and reads one tiny synthetic JSON metadata record through the `SOURCE_PDF_BUCKET` binding.
- Documented the local-only R2 smoke command and warned that calling the deployed endpoint would write a small object to the real R2 bucket.
- Verified the local Worker queue and R2 paths with Wrangler local bindings only.

### Files Changed

- `cloudflare/handover-pipeline/src/index.js`
- `docs/cloudflare-pipeline-runbook.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `GET http://127.0.0.1:8787/health` - passed.
- `POST http://127.0.0.1:8787/jobs` plus follow-up `GET /jobs/local-test-codex-002` - passed, completed one dry-run batch.
- `POST http://127.0.0.1:8787/cache/smoke` - passed against local simulated R2.
- `node --check cloudflare\handover-pipeline\src\index.js` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- No deployed Cloudflare resources were created or written during this pass.
- The real `/builder/projects` desktop modal/upload smoke still needs manual confirmation; the route rendered in scaffold mode, but the in-app browser did not activate modal buttons.

## 2026-06-20 - Cloudflare D1 Pipeline SQL Scaffold

### What Changed

- Added the D1 schema for pipeline-only SQL metadata: jobs, events, context segments, identity lookup cache, source candidates/results, source cache indexes, idempotency keys, and cost events.
- Added optional Worker prepared-statement writes that mirror dry-run job creation, candidate queueing, batch completion, and zero-cost dry-run meter events when `PIPELINE_DB` is configured.
- Documented the D1 setup/apply flow and kept Supabase as the product/auth/review/homeowner source of truth.

### Files Changed

- `cloudflare/handover-pipeline/schema.sql`
- `cloudflare/handover-pipeline/src/index.js`
- `cloudflare/handover-pipeline/wrangler.jsonc`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `node --check cloudflare\handover-pipeline\src\index.js` - passed.

### Unknowns/Risks

- No real D1 database was created or bound in this pass.
- The next D1 verification needs `wrangler d1 create`, a real `database_id`, schema application, and a local dry-run `/jobs` smoke with `PIPELINE_DB` configured.

## 2026-06-20 - Cloudflare Progress Sync Scaffold

### What Changed

- Added a Cloudflare Worker job-status fetch helper for `GET /jobs/<jobId>`.
- Added a server action that merges Worker dry-run progress back into extraction job usage metrics in Supabase mode or local scaffold mode.
- Added a builder project card refresh action and clearer Cloudflare queued, processing, and completed status copy.

### Files Changed

- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- End-to-end refresh was not clicked through a real browser with a running local Worker in this pass.
- Publish-readiness blocking on incomplete pipeline work is still intentionally deferred until live enrichment mode exists.

## 2026-06-20 - Cloudflare D1 Remote Setup

### What Changed

- Logged into Cloudflare through Wrangler OAuth.
- Created the remote D1 database `builder-handover-pipeline` in region `OC`.
- Bound the database as `PIPELINE_DB` in `cloudflare/handover-pipeline/wrangler.jsonc`.
- Applied `cloudflare/handover-pipeline/schema.sql` to the remote database.
- Verified the remote table list through `wrangler d1 execute --remote`.

### Files Changed

- `cloudflare/handover-pipeline/wrangler.jsonc`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npx.cmd wrangler d1 create builder-handover-pipeline` - passed.
- `npx.cmd wrangler d1 execute builder-handover-pipeline --remote --config cloudflare/handover-pipeline/wrangler.jsonc --file cloudflare/handover-pipeline/schema.sql` - passed, 19 queries, 36 rows written, 0.13 MB database.
- `npx.cmd wrangler d1 execute builder-handover-pipeline --remote --config cloudflare/handover-pipeline/wrangler.jsonc --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"` - passed.

### Unknowns/Risks

- No Worker deployment or live pipeline job used the remote D1 database yet.
- Next verification should run a tiny dry-run Worker job with D1 active and confirm pipeline rows are mirrored.

## 2026-06-20 - Cloudflare Public Worker Dry Run

### What Changed

- Created Cloudflare Queue `builder-handover-source-enrichment`.
- Created R2 bucket `builder-handover-source-cache`.
- Set `PIPELINE_SHARED_SECRET` on the Worker with a generated random value.
- Deployed the dry-run Worker to `https://builder-handover-pipeline.gpersson2002.workers.dev`.
- Updated local `.env.local` to point at the public dry-run Worker URL with the matching shared secret.

### Checks Run

- `GET /health` on the public Worker - passed with `d1Configured=true`.
- Authenticated `POST /jobs` on the public Worker - passed for `public-dry-run-d1-smoke-001`, 2 candidates, 1 batch, `d1State.skipped=false`.
- Follow-up `GET /jobs/public-dry-run-d1-smoke-001` - passed with `completed`, 1 completed batch, 0 failed batches, 2 dry-run results.
- Remote D1 count query - passed with 1 job, 2 candidates, 3 events, and 1 cost meter event for the smoke job.

### Unknowns/Risks

- The app upload flow has not yet dispatched to the public Worker from `/builder/projects`.
- R2 bucket exists for binding, but no object write was performed in this pass.
- Live source enrichment remains disabled.

## 2026-06-20 - Cloudflare Failed-Batch Retry Primitive

### What Changed

- Added Worker route `POST /jobs/<jobId>/retry-failed`.
- Failed dry-run queue batches now store candidate payloads in Durable Object job status.
- Retry requeues only failed batches with incremented retry attempts.
- D1 mirror writes now record failed batches and retry-queued events.

### Files Changed

- `cloudflare/handover-pipeline/src/index.js`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `node --check cloudflare\handover-pipeline\src\index.js` - passed.
- Direct Worker module mock for `POST /jobs/<jobId>/retry-failed` - passed.
- `npx.cmd wrangler deploy --config cloudflare/handover-pipeline/wrangler.jsonc` - passed, version `f390a04e-9895-47aa-91e5-2da9873b9299`.
- Public `POST /jobs/public-dry-run-d1-smoke-001/retry-failed` - passed with `no_failed_batches`.

### Unknowns/Risks

- No app-side retry button exists yet.

## 2026-06-20 - Cloudflare App-Side Failed-Batch Retry

### What Changed

- Added a server helper for `POST /jobs/<jobId>/retry-failed` against the
  configured Cloudflare Worker.
- Added a builder server action that persists retry status, requeued batch
  count, retry timestamp, and cleared retry errors into extraction job usage
  metrics.
- Added a `Retry failed batches` action to builder project extraction job cards
  when stored Cloudflare dry-run metrics indicate a failed job or failed batch
  count.
- Updated the runbook and phase docs so the remaining work is a failing-scenario
  UI smoke instead of adding the button.

### Files Changed

- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- A synthetic failing dry-run job still needs to be smoked through the real
  `/builder/projects` UI to prove the retry action end to end.

## 2026-06-20 - Cloudflare Local Retry Smoke Harness

### What Changed

- Added `scripts/smoke-cloudflare-retry.mjs`.
- Added `npm.cmd run cloudflare:smoke:retry`.
- The script imports the Worker module, mocks Durable Object storage and the
  Queue, runs `PIPELINE_MODE=dry_run_failure_test`, confirms the first batch
  fails once, retries exactly that failed batch, and confirms the retry
  completes with dry-run results.
- Updated the runbook, handoff, implementation phases, and testing log with the
  new repeatable local smoke.

### Files Changed

- `scripts/smoke-cloudflare-retry.mjs`
- `package.json`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run cloudflare:smoke:retry` - passed.

### Unknowns/Risks

- The real `/builder/projects` UI still needs to click through the failing
  dry-run retry flow with a running Worker/dev app.

## 2026-06-20 - Cloudflare Live-Pilot Admission Guard

### What Changed

- Added Worker safety metadata for pipeline mode, live-pilot enablement,
  candidate cap, search/cost budget state, and live-enrichment implementation
  state.
- Added a default-closed live-pilot admission gate:
  `PIPELINE_MODE=live_pilot` requires `LIVE_PILOT_ENABLED=true`.
- Added `LIVE_PILOT_MAX_CANDIDATES`, defaulting to 1, before any live source
  implementation exists.
- Added required `LIVE_PILOT_MAX_SEARCHES` and
  `LIVE_PILOT_MAX_ESTIMATED_COST_USD` admission checks.
- Persisted the admitted safety/budget snapshot into Durable Object job status
  and copied it onto queue messages.
- Added queue-time rejection for `PIPELINE_MODE=live_pilot` messages that do
  not carry the admitted safety/budget snapshot.
- Added zero-cost dry-run `budgetUsage` recording on completed batches and
  aggregate job status.
- Added `scripts/smoke-cloudflare-live-guard.mjs` and
  `npm.cmd run cloudflare:smoke:live-guard`.
- Updated the handoff, implementation phases, runbook, and testing log.

### Files Changed

- `cloudflare/handover-pipeline/src/index.js`
- `scripts/smoke-cloudflare-live-guard.mjs`
- `package.json`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run cloudflare:smoke:live-guard` - passed, including missing-budget
  rejection, tampered queue-message rejection, and safety/budget propagation to
  job status plus queue messages, plus zero-cost budget usage on completion.
- `npm.cmd run cloudflare:smoke:retry` - passed with zero-cost budget usage.

### Unknowns/Risks

- Live source enrichment is still not implemented and remains intentionally
  disabled. The next live-pilot step needs a concrete per-job cost/search budget
  before any OpenAI or web-search call is wired behind the gate.

## 2026-06-20 - Cloudflare Budget Usage In App Status

### What Changed

- Added app-side parsing for Worker `budgetUsage` returned by
  `/jobs/<jobId>`.
- Merged synced `budgetUsage` into extraction job usage metrics for Supabase
  and local scaffold persistence.
- Updated the builder project extraction job card to show pipeline usage as
  searches used plus estimated cost.
- Updated the handoff, implementation phase plan, runbook, and testing log.

### Files Changed

- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `node --check src\lib\server\cloudflare-pipeline.ts` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.
- `npm.cmd run cloudflare:smoke:live-guard` - passed.
- `npm.cmd run cloudflare:smoke:retry` - passed.

### Unknowns/Risks

- Still needs a real `/builder/projects` UI smoke with a running Worker to
  click refresh and confirm the displayed 0-search/$0.00 usage survives reload.

## 2026-06-20 - Publish Readiness Pipeline Gate

### What Changed

- Added a shared workflow readiness blocker for Cloudflare pipeline work that
  is explicitly marked live/required for publish.
- The blocker counts required pipeline jobs unless their stored pipeline status
  is `completed`; failed status sync also blocks.
- Current dry-run jobs remain non-blocking unless future metadata marks them as
  required for publish.
- Updated the handoff, implementation phase plan, and testing log.

### Files Changed

- `src/lib/workflow-readiness.ts`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- The future live-pilot implementation must deliberately set
  `requiredForPublish`, `liveEnrichmentRequired`, `pipelineMode=live_pilot`, or
  equivalent live metadata when a source job should block publish.

## 2026-06-20 - Source Cache Metadata Dry Run

### What Changed

- Added deterministic planned source-cache references to Worker dry-run results
  and aggregate job status.
- Used the key pattern
  `dry-run/source-cache/<job>/<identity>/<source-hash>.json`.
- Parsed and persisted planned source-cache references during app-side
  Cloudflare status sync.
- Mirrored planned cache keys into D1 `source_cache_index` with
  `status='planned'` and linked `identity_lookup_cache.source_cache_key` when
  the D1 binding is present.
- Updated the builder project extraction job card to show `Source cache
  dry-run` metadata.
- Updated Worker module smokes, including a D1 mock assertion, plus the
  runbook, phase plan, handoff, and testing log.

### Files Changed

- `cloudflare/handover-pipeline/src/index.js`
- `scripts/smoke-cloudflare-live-guard.mjs`
- `scripts/smoke-cloudflare-retry.mjs`
- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `node --check cloudflare\handover-pipeline\src\index.js` - passed.
- `npm.cmd run cloudflare:smoke:retry` - passed and confirmed the D1 mock
  received planned `source_cache_index` writes.
- `npm.cmd run cloudflare:smoke:live-guard` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed after tightening TypeScript narrowing in the
  app-side cache-reference parsers.

### Unknowns/Risks

- Planned cache keys are metadata only. The normal dry-run queue path still
  does not write R2 objects; `/cache/smoke` remains the only synthetic R2 write
  endpoint and should not be called publicly without confirmation.

## 2026-06-21 - Cloudflare Safety Metadata App Sync

### What Changed

- Added app-side parsing for the Worker `safety` snapshot from job creation and
  status responses.
- Preserved `pipelineMode`, `dryRunEnrichment`, `liveEnrichmentEnabled`, and
  the full safety/budget snapshot when Cloudflare status refresh merges into
  extraction job usage metrics.
- Updated builder project extraction job cards to label guarded live-pilot
  metadata separately from ordinary dry-run jobs.
- Updated the phase plan, handoff, and testing log so future live-pilot work
  knows the app-side publish gate can read stored Worker metadata.

### Files Changed

- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run cloudflare:smoke:live-guard` - passed.
- `npm.cmd run cloudflare:smoke:retry` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- This only persists safety metadata. It does not enable live source
  enrichment, public Cloudflare calls, R2 writes, OpenAI calls, or web search.

## 2026-06-21 - Cloudflare D1 Dry-Run Smoke

### What Changed

- Added `scripts/smoke-cloudflare-d1-dry-run.mjs`.
- Added `npm.cmd run cloudflare:smoke:d1-dry-run`.
- The smoke imports the Worker module and uses mocked Durable Object, Queue, and
  D1 bindings to verify the local dry-run D1 write contract.
- It covers job creation, source candidate inserts, job events, zero-cost meter
  events, planned source-cache index rows, identity cache links, and completed
  dry-run job status.
- Updated the phase plan, handoff, and testing log so Phase 11D has a local
  repeatable D1 smoke without remote Cloudflare.

### Files Changed

- `package.json`
- `scripts/smoke-cloudflare-d1-dry-run.mjs`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run cloudflare:smoke:d1-dry-run` - passed.
- `npm.cmd run cloudflare:smoke:live-guard` - passed.
- `npm.cmd run cloudflare:smoke:retry` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- This is a module-level smoke with mocked bindings. A Wrangler-local simulated
  binding smoke is still useful before relying on local dev behavior, but no
  public Cloudflare, R2, OpenAI, source search, source PDF fetch, or live
  enrichment ran here.

## 2026-06-21 - Cloudflare-first Next.js App Deployment Plan

### What Changed

- Added a docs-only deployment plan for hosting the Next.js 16 product app on Cloudflare Workers with the OpenNext Cloudflare adapter.
- Documented current compatibility findings from repo inspection and current Cloudflare/OpenNext/Supabase docs.
- Identified likely package/config additions, required app and secret environment variables, Supabase key handling rules, routes/server actions needing workerd compatibility review, deployment commands, validation steps, risks, and blockers.
- Updated `WORKSHEET.md` with the completed planning item and next recommended implementation task.

### Files Changed

- `docs/cloudflare-nextjs-deployment-plan.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - not available in Codex cloud's Linux shell; reran as `npm run lint`.
- `npm run lint` - passed in Codex cloud.

### Unknowns/Risks

- This was intentionally docs/config planning only; no OpenNext packages or root app Wrangler config were added yet.
- The largest expected blockers remain PDF/OCR compatibility under workerd, accidental local filesystem fallback in production, large upload limits, and Supabase auth/proxy behavior in Workers preview.
- A real `opennextjs-cloudflare build`/preview smoke is still required before declaring the Next.js app production-ready on Cloudflare.

### Suggested Next Task

Implement the smallest OpenNext/Wrangler product-app config PR, then run Cloudflare preview against Supabase + LlamaCloud configuration before any custom-domain cutover.

## 2026-06-21 - Extraction Admin-Noise Guardrails

### What Changed

- Added shared extraction guardrails that identify pure admin/legal/contract/preliminaries/site setup/scaffolding/temporary works/council/insurance/health-and-safety/generic workmanship noise while preserving homeowner-relevant warranties, manuals, certificates, producer statements, appliances, fixtures/fittings, flooring, cladding, roofing, paint/finish selections, and maintenance requirements.
- Applied the guardrails to deterministic spec preview extraction and outline-spec workflow normalization so pure admin noise is filtered before review/package rows are created.
- Tightened the OpenAI extraction prompt and outline-spec schema description to avoid promoting admin noise and to use the current `source_ready_unknown` classification name.
- Documented the guardrail policy in the context-first extraction/source-gap strategy.

### Files Changed

- `src/lib/ai/extraction-guardrails.ts`
- `src/lib/ai/spec-extract.ts`
- `src/lib/ai/outline-spec-normalize.ts`
- `src/lib/extraction/outline-spec-schema.ts`
- `src/lib/server/document-extraction.ts`
- `docs/context-first-extraction-and-source-gap-strategy.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm run lint` - passed in Codex cloud.
- `npm run build` - failed in Codex cloud because `next/font` could not fetch Geist and Geist Mono from Google Fonts in that environment.

### Unknowns/Risks

- Guardrails are intentionally conservative and may drop pure admin-only rows entirely; if the business wants rejected/noise audit rows, add a separate non-handover extraction log instead of putting them into homeowner package candidates.
- Build should be rerun locally where Google Fonts can be fetched or after switching to vendored/local fonts.

### Suggested Next Task

Run a real/scanned outline spec through LlamaCloud or OCR-backed extraction and confirm the review queue contains homeowner-relevant products/documents/maintenance only, with admin/preliminaries/site setup noise absent from package candidates.

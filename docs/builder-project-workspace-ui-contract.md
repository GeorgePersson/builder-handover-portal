# Builder Project Workspace UI Contract

Last updated: 2026-06-26

This document is the fallback contract for the Builder Handover Portal project workspace UI. If a future change regresses the page, rebuild it toward this behaviour before adding new features.

Primary route: `/builder/projects`

Primary component: `src/components/builder/projects-workspace.tsx`

## Product intent

The project workspace is the builder-facing operating screen for preparing a homeowner handover package. It should feel like a standalone project workspace, not a modal, debug tool, or cramped split pane.

The demo-ready happy path is:

1. Create/open a project.
2. Add handover items/products manually or from approved database autofill.
3. Upload required/legal/client documents.
4. Check completion blockers in the right sidebar.
5. Send/publish the package when ready.

Spec-sheet automation remains visible only as a calm future/secondary module unless explicitly being worked on. Do not let AI/spec/review copy dominate the manual handover workflow.

## Global layout rules

- Use the available app-shell width; avoid narrow centered `max-w-*` containers that create dead gutters.
- Left app sidebar remains the main app navigation.
- Project workspace content should use compact cards, modest padding, and dense but readable spacing.
- Persistent read-only context belongs in the right sidebar.
- Editable/detail modules belong in the main content column.
- Avoid duplicate CTAs. If a control exists in the sidebar, do not also place it in the header unless the user explicitly asks.
- Do not put `encType` or `method` on forms whose `action` is a React/Next server-action function; React supplies those automatically.

## Dashboard behaviour

Route: `/builder`

Dashboard rows should be clickable and deep-link into the correct workspace context.

Required links:

- Active project rows -> `/builder/projects?projectId=<projectId>`
- Client request rows -> `/builder/projects?projectId=<projectId>`
- Packages ready to send rows -> `/builder/projects?projectId=<projectId>`
- Upcoming maintenance rows -> `/builder/maintenance#project-<projectId>`

`/builder/projects` must read `projectId` and auto-open the matching project workspace rather than only showing the project browser.

## Project browser state

When no project is selected, `/builder/projects` should show a project browser/list with project metrics. Selecting a project opens its workspace on the same route.

The first project should not auto-open unless a valid `projectId` URL parameter was supplied.

## Project workspace header

The selected project workspace header should include:

- Back to projects
- Project name
- Status pill
- Property address
- Client/project type/target handover date summary
- Send package button
- Compact metrics:
  - Checklist items
  - Ready / accepted
  - Client docs
- Module filter buttons:
  - Overview
  - Items
  - Documents
  - Spec automation

The top header should **not** include a Client access button. Client access belongs in the right sidebar only.

## Module filter behaviour

The module buttons are stateful filters, not passive anchor links.

Required behaviour:

- Active module button is visually highlighted.
- Overview shows all primary modules together.
- Items shows only the handover item/product checklist module in the main content column.
- Documents shows the required handover/legal document upload module first, then existing project documents and maintenance/document-adjacent records.
- Spec automation shows only the spec automation coming-soon module.
- The right sidebar remains visible across module filters unless explicitly redesigned.

## Overview module

Overview must show the complete workspace, not a tiny summary-only view.

Current expected order in the main column:

1. Project details + Add client document in one compact top card.
2. Handover Items & Products module.
3. Spec sheet automation coming-soon module.
4. Documents in this project / maintenance-adjacent project records.

### Project details + Add client document card

This card intentionally uses side-by-side sections on wide screens because these are short admin sections.

Left side: Project details form

- Project name
- Project type
- Property address
- Target handover date
- Client name
- Client email
- Save button

Right side: Add client document form

- Title
- Type
- File picker
- Hidden `visibleToClient=on`
- Save button

The document form must stay compact. Title + Type can sit side by side, with file picker full-width below. Do not add visible client-toggle noise unless requested.

## Handover Items & Products module

Visible section title must be exactly:

`Handover Items & Products`

Purpose: manage the actual project handover products/items that the homeowner will receive.

Required controls/content:

- Add handover item button.
- Clickable category/group buttons above the list.
- Group buttons are data-driven from item categories such as Exterior, Interior, Kitchen, Bathroom, etc.
- Include an `All items` reset button.
- Show useful ready/total counts on category buttons.
- Keep search/status/source/missing-section/completion filters below the group buttons as secondary filters.
- Item cards should show product identity, source, status, missing sections, and expandable edit controls.

## Add handover item modal

The add-item modal supports both approved database autofill and manual entry in one flow. Do not add a redundant `Search database / Manual add` switch.

Required order:

1. Modal header/copy.
2. Database suggestions panel at the top.
3. Item-name/search input inside the suggestions panel.
4. Approved product database suggestions immediately below the search field.
5. Manual/detail fields below the suggestions panel.
6. Care/manual/warranty/compliance/supporting-doc fields below identity fields.
7. Submit button.

Behaviour:

- Typing an item name searches approved product records.
- Selecting a suggestion autofills known fields.
- The builder can still edit/review every field.
- Submitting without a suggestion is the manual path.
- Selected suggestion can be cleared to continue manually.

## Documents module

Documents tab must be more than a passive list.

Required top module:

`Upload required handover document`

Purpose: upload legal/compliance/handover evidence needed before the package is complete.

Supported examples in copy/type options:

- Code Compliance Certificate / consent records
- Producer statements
- Warranties
- Manuals
- Inspection records
- Photos / supporting evidence
- Other legal or compliance records

Upload form fields:

- Title
- Type
- File picker
- Hidden `visibleToClient=on`
- Save button

The upload form should be client-visible by default for demo/current workflow. It must not specify explicit `encType` or `method` because it uses a server action.

Below the upload module, show:

- Documents in this project
- Download/status information where available
- Maintenance/document-adjacent project records if still useful

## Right sidebar

The right sidebar is read-only/status/control context, not the main edit form.

Expected sidebar content:

- Client access card with the only Client access control.
- To be completed summary:
  - items incomplete
  - autofill checks
  - manuals missing
  - warranties missing
  - compliance docs missing
- Documents to upload / confirm guidance:
  - Code Compliance Certificate / consent
  - Product warranties
  - Manuals and care guides
  - Producer statements / inspection records
  - Photos / supporting evidence
- Item categories with item counts and ready counts.
- Demo path reminder if useful.

The sidebar may stay visible while module filters change.

## Visual regression checklist

Use this checklist when reviewing changes:

- Project page does not have huge unused gutters.
- Project opens as a standalone workspace, not a modal/split overlay.
- Back to projects is visible.
- Top Client access button is absent.
- Sidebar Client access control remains available.
- Overview button shows all primary modules.
- Items button filters to item checklist only.
- Documents button shows legal/compliance upload at top before document list.
- Spec automation button shows only the coming-soon/future module.
- Add item modal has database suggestions/search at the top.
- Project details and Add client document sit side by side on wide screens.
- Detailed item entry/editing remains stacked and readable.
- Document-upload server-action forms have no explicit `encType` or `method`.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes, ignoring only the known Docling/Turbopack NFT tracing warnings.

## Suggested next steps / hardening plan

### 1. Freeze this UI contract in tests

Add Playwright smoke tests for:

- dashboard row deep-link opens `/builder/projects?projectId=...`
- project workspace opens from `projectId`
- top module filters show/hide the right modules
- Overview shows all modules
- Documents shows the legal/compliance upload form
- Add item modal opens with database suggestions panel above manual fields
- no `encType/method` console warning appears when opening/uploading documents

### 2. Add visual regression snapshots

Use Playwright screenshots for stable demo fixtures:

- project browser
- project workspace overview
- items tab
- documents tab
- add item modal with suggestions
- add item modal with no suggestions

Store snapshots for desktop first, then add tablet/mobile once layout stabilises.

### 3. Seed stable demo fixtures

Create or document a small deterministic fixture set:

- one project with no client
- one project with a client invite
- items across Exterior/Interior/Kitchen/Bathroom categories
- at least one complete item
- one missing-manual item
- one accepted-incomplete item
- one uploaded compliance document

This prevents regressions where categories, counts, or sidebar summaries appear empty and hide layout bugs.

### 4. Componentise repeated upload forms

The project workspace already benefits from a shared document-upload form pattern. Keep legal/compliance and client-document upload forms using one component so future fixes to server-action upload behaviour land in one place.

### 5. Add accessibility checks

Run axe/Playwright accessibility checks for:

- module filter buttons use `aria-pressed`
- file inputs have labels
- modal focus trapping/escape behaviour
- keyboard navigation across filters and item cards

### 6. Browser smoke before demo

Before investor/demo use:

1. Start dev server.
2. Open `/builder/projects`.
3. Open a project by direct dashboard link and by browser selection.
4. Add one manual item.
5. Add one database-autofilled item.
6. Upload a Code Compliance Certificate/consent placeholder file.
7. Switch Overview/Items/Documents/Spec automation tabs.
8. Confirm client portal/package pages show only reviewed/client-safe output.

### 7. Build hardening backlog

- Decide whether to fix or suppress the known Docling/Turbopack NFT tracing warnings.
- Add regression tests around document upload errors and status banners.
- Add a project-workspace story or fixture-render page if Playwright setup is slow.
- Keep `docs/agent-handoff-log.md` and `WORKSHEET.md` as chronological logs, but treat this document as the UI source of truth for the current intended layout.

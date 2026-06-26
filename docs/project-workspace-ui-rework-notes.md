# Project Workspace UI Rework Notes

Status: captured product direction only. Do **not** implement this before the extraction/checklist workflow is proven with a real upload smoke.

## Product intent

The project workspace should feel like a clear builder workflow, not an admin/debug console. The builder should always know:

1. where the project is up to,
2. what needs review,
3. what documents or item details are missing,
4. what can be sent to the client, and
5. what has already been sent/changed.

Keep the current visual style and colour system: clean, white/slate cards, cyan actions, status pills, rounded panels, and calm investor-demo polish.

## Projects tab / project list

Replace the current edit-button-driven feel with a proper project browser.

### Project list behavior

- Show all projects as clickable rows/cards; clicking anywhere opens the project.
- Keep a clear "New project" action.
- Add filters:
  - Ongoing
  - Ready to send
  - Sent
  - Possibly: Needs attention / blocked
- Each project card/row should show quick status at a glance:
  - Needs specification upload
  - Extraction running
  - Needs item review
  - Needs item approval
  - Needs required documents
  - Ready to send
  - Sent
- Avoid exposing debug/LLM/source-snippet language in the builder-facing summary.

## New project modal

Clicking "New project" should open a friendly modal before creating the project.

### Modal contents

- Quick project/client fields.
- Required confirmations:
  - I understand this uses one project credit.
  - I will review the generated handover information before sending it.
  - I understand item-specific warranties/manuals should be added where available; if missing, general care/maintenance guidance may be used where appropriate.
- A short process explanation:
  1. Create the project.
  2. Upload the specification PDF. This may take up to about 10 minutes.
  3. While it processes, add related documents such as Code Compliance Certificates, inspection reports, warranties, manuals, producer statements, photos, or other handover files.
  4. Review extracted items that need account approval, product matching, missing model/code details, or extra context.
  5. Attach or confirm required documents such as warranty, manual, care/maintenance, invoice/quote, or Code of Compliance evidence.
  6. Complete the checklist and send the handover package to the client.
  7. After sending, the system keeps a paper trail of opens, updates, and document changes.

After accepting/creating, close the modal and open the new project workspace page.

## Project workspace layout

After selecting or creating a project, open a dedicated project workspace with top tabs.

Recommended tabs:

1. Overview
2. Items
3. Spec upload / item review
4. Documents
5. Paper trail
6. Future: Spec sheet builder

Possible alternative: combine Documents into Overview until document volume justifies its own tab.

## Overview tab

Show the basic project information in a clean dashboard.

### Main information

- Project name
- Address
- Client name
- Client email
- Client phone number
- Target handover date
- Project type
- Created date
- Last updated date
- Sent/published date if available

### Right-side status module

A sticky or visually separate status card on the right should show milestones:

- Project created
- Specification uploaded
- Extraction complete
- Items reviewed
- Required documents added
- Checklist complete
- Ready to send
- Sent to client
- Client opened portal

Use clear statuses like complete, in progress, needs attention, blocked.

The overview should make it obvious what the next action is.

## Items tab

This is the builder-facing handover checklist/item library for the project.

### List layout

- Show items in neat cards/boxes.
- Group by defined sections such as:
  - Exterior
  - Interior
  - Appliances
  - Plumbing
  - Electrical
  - Heating / ventilation
  - Fixtures and fittings
  - Finishes
  - Other / uncategorised
- Each card should show enough quick information to distinguish the item:
  - Item name
  - Brand/manufacturer
  - Model/SKU/product code where available
  - Location
  - Status: needs review, needs document, ready, incomplete accepted, etc.

### Item detail view

Clicking an item opens a clean detail view with editable fields:

- Item name
- Category/section
- Brand/manufacturer
- Model
- SKU/product code
- Supplier
- Supplier SKU
- Location
- Quantity
- Finish/colour/variant
- Care/maintenance instructions
- Warranty information
- Linked warranty document
- Linked manual
- Linked invoice/quote if relevant
- Linked Code of Compliance / consent / producer statement if relevant
- Supporting documents
- Internal notes if needed

At the bottom, include a clearly labelled search/autofill area:

- "Search approved product database"
- Search by brand, model, product name, SKU, or supplier.
- Selecting a result should autofill known fields and make the source of those fields clear.

## Spec upload / item review tab

This tab is the extraction and review workspace.

### Top upload panel

Use the dedicated upload flow style from the current spec intake page.

- Select/upload PDF.
- Explain that processing can take up to about 10 minutes.
- Show processing progress and current state.
- Keep this simple and builder-friendly.

### Review filters

Under the upload panel, show filter cards/chips similar to the current review filter behavior:

- All review items
- Needs review
- Context requests / needs more information
- Needs source document
- Needs model/code
- Package ready
- Rejected/excluded

Clicking a filter updates the item list below.

### Review item cards

- Display two cards per row on desktop.
- Each card should show only builder-useful quick info:
  - Item name
  - Brand/manufacturer
  - Model/product code if known
  - Location
  - Category
  - What it needs next
- Do not show LLM metadata, source snippets, raw reviewer notes, token info, or other debug wording in the normal UI.
- Keep the debug/source evidence fields available somewhere temporarily while extraction is still being tuned.

### Review item detail

Clicking a review item should open the same detail view/pattern used in the Items tab, with actions appropriate to review:

- Accept / approve item
- Delete / exclude item
- Add or link warranty document
- Add or link manual
- Add or link care/maintenance instructions
- Add or link invoice/quote if required
- Add or link Code of Compliance / consent / producer statement where relevant
- Continue without adding information, but only with an explicit reason when required
- Search approved product database and autofill fields
- Mark as builder supplied with notes where appropriate

## Documents tab

Possible tab if not folded into Overview.

Show all project documents grouped by type:

- Specification PDF
- Warranty
- Manual
- Care/maintenance
- Invoice/quote
- Code Compliance Certificate / consent
- Producer statement
- Inspection report
- Photos
- Other

Each document should show:

- Name
- Type
- Uploaded date
- Visible to client yes/no
- Linked item(s), if any
- Status / missing review if needed

## Paper trail tab

For sent projects, show a clean timeline.

Include:

- Date package was sent
- Date client first opened the portal
- Dates information was updated
- Dates documents were added/replaced
- Dates items were approved, excluded, or accepted incomplete
- Dates client-facing package was republished or changed

Keep this human-readable and audit-friendly, not technical.

## Future tab: Spec sheet builder

Later, add a tab for creating a specification sheet inside the app.

Goal:

- Let builders create a structured spec sheet from a template.
- Use a format that is easy for the system to read and extract from.
- This could eventually reduce messy PDF extraction problems because the source data would already be structured.

Do not build this yet; capture it as a future product direction.

## Important implementation guardrails

- Stay focused on extraction/checklist quality first.
- Do not redesign the UI until real spec upload -> extraction -> checklist candidate sync is working well.
- When implementing later, hide debug/LLM/source-snippet details from normal builder UI but keep a temporary debug drawer/panel for extraction tuning.
- Keep the style consistent with the existing app rather than introducing a new design language.
- Prefer project-level tabs and item detail panels over many disconnected modals.
- Make next actions obvious: upload, review, add documents, approve, send.

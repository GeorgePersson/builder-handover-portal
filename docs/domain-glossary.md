# Domain Glossary

## Project

A residential build or handover job owned by a builder organisation. It groups uploads, extracted items, clients, review state, and the final handover package.

## Unit

One dwelling or sub-project within a larger development. A unit can inherit from a base project and then receive per-unit edits or variations.

## Variation

A project-specific change from the base specification, such as a different finish, supplier, model, quantity, location, or warranty/care detail.

## Spec Sheet

A builder specification document that lists products, finishes, documents, allowances, trades, or maintenance obligations. It is the primary intake source.

## Quote

A supplier, trade, or subcontractor document that may contain product details missing from the spec sheet. Quote references should be linked back to the item they clarify.

## Manual

A product, supplier, installer, or manufacturer document that explains installation, operation, care, maintenance, or warranty obligations.

## Product/Item

An extracted handover-relevant row. It may be a physical product, a required document, or a maintenance task. Product identity should include enough context to avoid confusing similar items.

## Manufacturer

The company or brand that makes the product. Manufacturer is part of product identity and source authority.

## Supplier

The company that supplies or sells the product for the project. Supplier can differ from manufacturer and may change due to availability, quote, or builder choice.

## Builder Review

The internal review step where a builder checks AI-extracted or matched items, edits values, supplies missing context, uploads supporting documents, excludes irrelevant rows, and approves package-ready items.

## Client Handover

The homeowner-facing package or portal published after builder review. It should show clean, useful, reviewed care and maintenance information.

## Care And Maintenance

Guidance for maintaining an item or satisfying warranty expectations. It may be manufacturer-sourced, supplier-sourced, builder-supplied, general AI fallback, or unknown/unresolved.

## Confidence Score

A numeric or labelled signal showing how reliable an extraction, match, or source-enriched result appears. Low confidence should trigger review rather than silent publication.

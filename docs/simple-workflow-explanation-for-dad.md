# Simple Explanation Of The New Handover Workflow

This is the plain-English version of how the new system will work.

## The Big Idea

The builder uploads the project specification, and the system helps turn it into
a homeowner handover pack.

The system does not just search the internet straight away. First it reads the
document, checks what it already knows, and asks the builder to confirm or add
missing details. This saves money and avoids searching for the wrong thing.

## Step 1: The Builder Uploads The Spec

The builder uploads the project specification PDF.

This might be the main building spec, an outline spec, a selections document,
or another project document that lists products, materials, fixtures, fittings,
appliances, and maintenance items.

The builder does not have to sit there while everything finishes. The system can
process the document in the background, and the builder can come back later to
review the results.

## Step 2: LlamaCloud Reads The Document

The uploaded PDF is scanned using LlamaCloud.

LlamaCloud helps read messy documents, scanned pages, tables, schedules, and
long specification files. It turns the PDF into cleaner information the system
can work with.

## Step 3: The Schema Pulls Out The Items

The system uses a schema to tell LlamaCloud what to look for.

The schema is basically a list of fields we want to capture, such as:

- Product name
- Brand or manufacturer
- Model number
- Supplier
- Product code
- Finish or colour
- Size
- Quantity
- Location in the house
- Notes from the spec
- Page or section where the item came from

This schema will keep improving over time. As we test more real builder specs,
we can update the schema so the system gets better at finding the right items.

## Step 4: The System Checks The Database

After the system finds the items, it checks the product database.

If it finds a strong match, it means the system already knows that item.

For example, if the spec says a certain oven model and that oven already exists
in the database, the system can match it automatically.

## Step 5: Known Items Are Accepted Faster

Items that match the database with high confidence can be accepted quickly.

The builder still gets visibility, but they do not need to waste time searching
for information that is already known.

This is one of the biggest time savers.

## Step 6: New Items Go To The Builder For Approval

If the item is new and not already in the database, the builder checks it.

The builder can confirm:

- Yes, this item is correct
- No, this item should not be included
- This item needs editing
- This item needs more information before searching

The system does not search the internet for every new item immediately. The
builder confirms first so the system does not waste money searching for things
that are wrong, vague, or not needed.

## Step 7: Items That Need More Context Ask The Builder

Some items will not have enough detail.

For example, the spec might say:

- Kitchen appliances TBC
- As per kitchen quote
- Tapware by supplier
- Paint colour to client selection
- Heat pump to be confirmed

These are real items, but they are not specific enough to search properly.

The system asks the builder for more context, such as:

- Brand
- Model number
- Supplier quote
- Product code
- Warranty document
- Manual
- Photo
- Invoice
- Care instructions

Once the builder adds that information, the system checks the database again.

If the spec says something like "as per Kitchen Solutions quote", the builder
can upload that quote. The system can then read the quote, pull out the missing
products, and link them back to the original item in the spec.

## Step 7A: Builders Can Edit Variations

Sometimes the product changes after the first spec is created.

For example, the builder might change:

- Finish
- Colour
- Model
- Supplier
- Quantity
- Location

The builder can edit the item, and the system should keep a record of what the
original spec said and what the builder changed it to.

## Step 8: Only Ready Items Get Sent To Web Search

After database checking and builder clarification, only the right items get sent
to web search.

This means the system searches only when:

- The builder has confirmed the item belongs in the handover
- The item is not already in the database
- The item has enough detail to search properly
- The project has budget available for searching

This avoids searching twice and keeps costs under control.

## Step 9: The Builder Checks The Search Results

When web search finds information, the builder checks it.

The system might find:

- Product manuals
- Warranty information
- Maintenance instructions
- Care guides
- Official product pages
- Installation documents

The builder can then approve the result, edit it, reject it, or ask for more
information.

## Step 10: Approved Items Go Into The Handover Pack

Once items are checked and approved, they become part of the homeowner handover
pack.

The homeowner only sees clean, approved information.

They do not see:

- Raw AI output
- Unchecked items
- Missing information warnings
- Internal builder notes
- Failed searches
- Admin review details

The system also keeps private project documents private. The homeowner only sees
the final approved handover information, not the builder's raw spec or internal
review notes.

## Step 11: Warranties And Manuals Can Be Updated Later

Products, manuals, and warranty information can change over time.

The system should store the version that was approved for the handover pack. If
a warranty or manual changes later, the system can create a new version and ask
the builder or admin to review the update.

This means old handover packs do not silently change without anyone checking
them.

## Step 12: Multi-Unit Projects Can Be Copied

For townhouses, apartments, or multiple lots, the builder should be able to copy
one project into several units.

The system copies the products, documents, categories, suppliers, warranties,
and maintenance information into each unit. Each unit can still be edited
separately afterwards.

## Step 13: Suppliers Are Stored Separately

The system should store who makes the product and who supplies it separately.

For example, a product might be made by an overseas manufacturer but supplied in
New Zealand by a local merchant or distributor.

This lets the builder attach supplier contact details, supplier quotes,
supplier links, warranty notes, and maintenance information.

## Why This Workflow Is Better

This workflow is better because it is more accurate and cheaper to run.

Instead of searching the internet for everything, the system works in the right
order:

```txt
Upload spec
-> read the document
-> extract the items
-> check the database
-> builder confirms or adds missing info
-> check the database again
-> search the web only for confirmed unknown items
-> builder approves
-> homeowner receives the final handover pack
```

## Simple Summary

The builder uploads the spec.

LlamaCloud reads it.

The schema pulls out the products and handover items.

The system checks the database first.

Known items are accepted quickly.

New or unclear items go back to the builder.

The builder adds missing details.

Only confirmed unknown items are searched online.

The builder checks the search results.

Approved items go into the homeowner handover pack.

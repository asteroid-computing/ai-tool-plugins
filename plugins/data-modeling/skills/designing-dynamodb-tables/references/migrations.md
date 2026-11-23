# Migrations

Use this file to add an entity, an attribute or an access pattern to a table that already has items.
A model changes when the application changes.
Most changes need no work on existing items.
Some changes need a backfill: a job that writes new attributes to existing items.

## Contents

- The main question
- Change types, easiest first
- Backfill procedure
- A change to a base table key

## The main question

Does the change need new index attributes on existing items?

- Application attributes do not matter here. The application can read an item without a new attribute and use a default value.
- Index attributes matter. An existing item enters a new item collection only when it has the key attributes of that collection.

If the answer is no, the change is additive: deploy the new code and continue.
If the answer is yes, plan a backfill.

## Change types, easiest first

**1. A new application attribute.**
Write it on new and updated items.
Read it with a default value when it is missing.
No backfill is necessary.

**2. A new entity that no access pattern reads with an existing entity.**
Give it its own item collection.
No existing item changes.

**3. A new entity in an existing item collection.**
For example, attachments in the item collection of a ticket.
This is additive when the existing collection has space for the new type: no other relationship uses the same side of the parent, and no access pattern reads past the new items.
Check the read direction and the sort key prefixes. See [sorting-and-pagination.md](sorting-and-pagination.md).

**4. A new entity in a new item collection with existing items.**
For example, the parent's item collection already serves a different relationship, so the parent and the new children must meet in a GSI.
Existing parent items need the GSI key attributes.
If the GSI keys are attributes that the items already have, use a multi-attribute GSI key. DynamoDB then fills the new index from the existing items, and no backfill is necessary.
Otherwise, backfill the new attributes on the existing parents.

**5. A new access pattern on existing items.**
For example, a new order, a new filter, or two entity types read together for the first time.
Add a GSI for it.
As in type 4, a GSI on attributes that the items already have needs no backfill.
A GSI on new attributes needs a backfill.

## Backfill procedure

1. Deploy the code that writes the new attributes on every new and updated item. Do this first, so that the backfill does not miss items that change while it runs.
2. Make the code read correctly when an item does not have the new attributes yet.
3. Add the GSI, if the change needs one. DynamoDB adds existing items that already have its key attributes.
4. Run the backfill job:
   - Scan the table with a filter on the `Type` attribute, one page at a time. Use parallel Scan segments (`Segment`, `TotalSegments`) for a large table.
   - Update each item with `attribute_exists(PK)`, so that the job does not create an item that a user deleted during the scan.
   - Make each update safe to repeat: set the values, do not add to them.
   - Save the last key of each finished page, so that the job can continue after a failure.
   - Stop only when a page has no `LastEvaluatedKey`.
   - Limit the write rate, so that the job does not slow the application.
5. Check that every item of the type has the new attributes, for example with a second Scan that counts items without them.
6. Move the reads to the new key or index.

`BatchWriteItem` cannot update an item, so a backfill that adds attributes uses `UpdateItem` for each item.
A job that replaces whole items can use `BatchWriteItem`, or the bulk put of items from S3. Neither one accepts a partial update.

## A change to a base table key

The key schema of a table, its attribute names and types, never changes.
A change to the format of key values, for example a new sort key prefix, is a new item for each old item.

1. Write the new items and delete the old ones, in pairs, in a job that can resume.
2. Until the job ends, read the new key, and read the old key when the new key has no item.
3. Update each item that stores the old key.

A change to the key schema needs a new table and a copy of the data, for example with export to S3 and import from S3.
This is the most expensive change.
Thus, choose the key schema of a new table with care. See [keys-and-indexes.md](keys-and-indexes.md).

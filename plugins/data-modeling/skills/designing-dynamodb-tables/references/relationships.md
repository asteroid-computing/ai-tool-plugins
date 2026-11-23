# Relationships

Use this file to model a one-to-one, a one-to-many or a many-to-many relationship.
DynamoDB has no joins.
Thus, store related items so that one request returns them, or accept a second request and state why.

## Contents

- One-to-one
- One-to-many: decision order
- Many-to-many: decision order
- Copies of data

## One-to-one

Store the child as an attribute of the parent item, for example a map.
Use a separate item only when the child is large and the parent's access patterns rarely need it.

## One-to-many: decision order

Do the checks in this order, and use the first strategy that fits.
Use a different strategy for each relationship when that fits better.

**1. Attribute on the parent.**
Store the children in a list or a map attribute of the parent item.
Use this strategy only when both conditions are true:

- No access pattern finds a child by a value of the child. DynamoDB cannot use a list or a map in a key.
- The number of children has a known upper limit, and the parent item stays well below 400 KB at that limit.

If the product can set a limit at no cost to the user, propose it. For example, a maximum of ten emergency contacts.
Write the limit in the entity chart.

**2. Children in the parent's item collection, in the base table.**
Give the children the partition key of the parent, and a sort key that orders them.
One Query on the partition key returns the parent and its children.
A sort key condition such as `begins_with(SK, "REVIEW#")` returns the children without the parent.
Use this strategy when an access pattern reads the parent with its children.
Put the parent item at the end of the collection that the read starts from. See [sorting-and-pagination.md](sorting-and-pagination.md).

**3. Children in the parent's item collection, in a GSI.**
Give each child its own base table key, and give the parent and the children the same GSI partition key.
Use this strategy in two cases. The parent's base item collection already serves a different relationship. Or each child needs its own base key, for example for uniqueness.
Do not add many children to a base collection that another access pattern reads, because the Query must then read past them.

**4. Hierarchical sort key.**
Put the levels of a hierarchy in the sort key, from the top level down, for example `<region>#<city>#<siteId>`.
`begins_with` on a prefix then returns every item at or below that level.
Use this strategy when the hierarchy has more than two levels. An access pattern at a level must want all items below it.
Do not use it when a read wants one level only, because the result then includes the lower levels.

**5. Separate item collection, without the parent.**
When no access pattern reads the parent with its children, give the children their own partition key, for example `RECIPE#<recipeId>#REVIEWS`.
The parent item does not need to be in the collection.

## Many-to-many: decision order

A many-to-many relationship has two read directions, for example "the shifts of a volunteer" and "the volunteers of a shift".
Choose a strategy for each direction.
The two directions can use different strategies.

**1. Short copy on one side.**
Store a bounded list of the related identifiers, with fields that do not change, as an attribute of one entity.
That direction then needs one `GetItem`.
Model the other direction with a one-to-many strategy.
Use this when the list has a known upper limit and the copied fields do not change.

**2. Relationship item with an inverted index.**
Store one item for each relationship, in the item collection of one entity: `PK = SHIFT#<shiftId>`, `SK = VOLUNTEER#<volunteerId>`.
Give the relationship item the swapped values in a GSI: partition key `volunteerId`, sort key `shiftId`.
The base table then gives the volunteers of a shift, and the GSI gives the shifts of a volunteer.
Put on the relationship item only the fields that do not change, for example the sign-up time.
Read the fields that change from the entity items.
Use this strategy for most many-to-many relationships.

**3. Relationship items, then a batch read.**
Store relationship items that hold only the identifiers.
Read them with a Query, then read the related entity items with one `BatchGetItem`.
Use this strategy when the related data changes often and many relationship items would hold copies of it. For example, the stock level of a product that is on thousands of wish lists.
This is two requests, but the second is one batch, not one request for each item.

**4. Entity graph.**
Store each node as several items, one for each relationship type. Use a GSI to group the items by the related value.
Use this only for data with many relationship types between many node types.
It is rarely needed.

## Copies of data

A copy of a parent's field on a child item removes a read, but each change of the field must update every copy.
Before you copy a field, answer two questions:

- Does the field change? A field that never changes, such as a name at the time of an order, is safe to copy.
- If it changes, how often, and how many items hold a copy? A rare change to a few items is acceptable. A frequent change to many items is not.

Write each copy and its update path in the notes of the entity chart.
If a change must update all copies together, use a transaction and check the transaction limit in [limits.md](limits.md).

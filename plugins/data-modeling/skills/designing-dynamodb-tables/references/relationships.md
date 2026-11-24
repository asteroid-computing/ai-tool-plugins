# Relationships

Use this file for step 5: model each relationship, and decide which values to copy between items.
DynamoDB has no joins.
Thus, store related items so that one request returns them, or accept more requests and state why.

## Contents

- Aggregate choice
- One-to-one
- One-to-many: decision order
- Many-to-many: decision order
- Denormalisation

## Aggregate choice

For each parent and its children, choose how tightly to store them:

| Choice                                                       | Use it when                                                                                                 | Cost                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Embed the children in the parent item                        | The children are read only with the parent, their number has a small limit, and they change with the parent | Each change of one child rewrites the whole item |
| Item collection: parent and children under one partition key | A pattern reads the parent with its children, the children are many or change on their own                  | One more item type in the collection             |
| Separate: the children have their own partition key          | No pattern reads the parent with its children, or the children are written by their own identifier          | A second request when a page needs both          |

No single number decides the choice.
A high share of reads that need both pushes toward embedding or a collection.
Large items, many independent child writes, and an unlimited number of children push toward separate items.

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
Put the parent item at the end of the collection that the read starts from. See [single-table-patterns.md](single-table-patterns.md).

In a table of one entity type, the same idea is an identifying relationship: the parent identifier is the partition key and the child identifier is the sort key. This serves "children of a parent" with no GSI.
The exception is a frequent write that has only the child's identifier, for example a webhook for one order line. `UpdateItem` needs the full key. Then key the child by its own identifier, and put the parent identifier in a GSI.

**3. Children in the parent's item collection, in a GSI.**
Give each child its own base table key, and give the parent and the children the same GSI partition key.
Use this strategy in two cases. The parent's base item collection already serves a different relationship. Or each child needs its own base key, for example for uniqueness.
Do not add many children to a base collection that another access pattern reads, because the Query must then read past them.
If no pattern reads the parent with these children, use a dedicated GSI on the children only.

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
Give the relationship item the swapped values in a GSI.
The base table then gives the volunteers of a shift, and the GSI gives the shifts of a volunteer.
Use one inverse GSI for each relationship. In a table of this relationship only, give it descriptive keys, for example `volunteerId` and `shiftId`. In a shared table, see [single-table-patterns.md](single-table-patterns.md).
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
It is rarely needed. For queries that follow many hops, use a graph database such as Amazon Neptune.

## Denormalisation

Denormalisation stores data in the shape that a read needs, so that the read does not join.
It has two forms:

- **A complex attribute:** related data as a list or map on one item. This is strategy 1 above.
- **A copy:** a value of one item stored on other items, for example a member's name on each review.

Copy a value only when all these conditions are true:

1. An access pattern reads the copy, and the copy removes a request from it. A copy that no read uses is cost with no benefit.
2. The value never changes, or it changes rarely and few items hold a copy.
3. The design names the update path of each copy.

Choose the update path from the number of copies:

| Copies of one value                   | Update path                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A few, with a known limit             | Update them in the same transaction as the source. Check the transaction limit in [limits.md](limits.md) |
| Many, and a short delay is acceptable | A stream consumer updates them after the source changes. It must be safe to run twice                    |
| A curated set, such as a front page   | Rewrite the whole item when an editor changes the set                                                    |
| Any, and the copy is a snapshot       | Do not update. State that the copy records the value at that time, for example a price on an order       |

Do not copy a value that changes often into many items. Read it from its source item with `BatchGetItem` instead.
Do copy a display value that rarely changes, such as a person's name, when the copy removes a serial `BatchGetItem` from a frequent read. A second request on each read costs more than a rare update of the copies.
Write each copy and its update path in the notes of the entity chart and in the write entries of the query pattern library.

# Single-table patterns

Use this file when a table or an index holds more than one entity type.
These patterns come from The DynamoDB Book.
Use each one only when it gives a saving over the AWS default. Write the saving in the entity chart, as SKILL.md says.

## Contents

- Key format in a shared table
- Pre-joined item collections
- Where the parent sorts
- An item collection in a GSI
- Inverted index for many-to-many
- Shared key format for uniqueness
- Vertical partitioning
- When a pre-join does not fit
- The cost of overloaded keys
- Worked example: a library

## Key format in a shared table

- **Make a key attribute generic only when it holds more than one entity type.** If the partition key means the same in every item, for example `branchId`, keep that name. Make only `SK` generic.
- **Start each key value with its entity type**, for example `MEMBER#<memberId>`. Two entity types then cannot write the same key, and each item is easy to identify.
- **Give each item a `Type` attribute** with its entity name. A migration uses it to find the items of one type, and an export uses it to put each type in its own table again.
- **Keep the application attributes** on each item, also when the key already holds the value. Code then never parses a key, and a later key change loses no data.
- **Give each GSI its own key attributes.** Do not use `SK` as the sort key of a GSI because the values are the same today. A later entity can need different values.
- **Name a single-type GSI for its job**, for example `holdsByMember`, with descriptive attributes. Use `GSI1PK` and `GSI1SK` only for an index that holds more than one entity type.

## Pre-joined item collections

DynamoDB has no joins. A join in the application makes two requests, one after the other.
A pre-join puts the related items in one item collection when they are written. One Query then returns them all.

Use a pre-join when an access pattern reads two entity types together, for example a member and the member's recent loans.
Saving: one request in place of two serial requests, or two parallel requests.
State the AWS alternative that you compared: a `GetItem` and a `Query` in parallel.

Do not pre-join entities that no access pattern reads together. A pre-join with no read is coupling with no benefit.
Do not add a large child type to a collection that another pattern reads, because that Query must then read past the children.

## Where the parent sorts

A Query reads one item collection in sort key order, from one end.
Thus, put the parent item at the end where the read starts.

- **Children newest first:** sort the parent after the children, and read in descending order. For example, `LOAN#<loanedAt>` sorts before `MEMBER#<memberId>`.
- **Children oldest first:** sort the parent before the children, and read in ascending order. A `#` at the start of the parent's sort key, as in `#TITLE`, sorts it before letters and digits.
- **Two relationships in one collection:** put the parent in the middle. Read one relationship in ascending order from the parent, and the other in descending order. Use a key condition such as `SK >= <parent SK>` or `SK <= <parent SK>`.

Two relationships that both need descending order cannot share one collection. Put one of them in a GSI.

## An item collection in a GSI

The base table has one item collection for each partition key. When that collection already serves one relationship, a second relationship can pre-join in a GSI.
Give the parent and the children the same GSI partition key, with type-prefixed sort keys.
This GSI holds more than one entity type, so it uses `GSI1PK` and `GSI1SK`.

Use it when one pattern reads the parent with these children in one request.
If the pattern needs only the children, use a dedicated GSI with descriptive multi-attribute keys. Read the parent with a parallel `GetItem` if the page needs it.

## Inverted index for many-to-many

Store one relationship item for each pair, in the item collection of one entity.
For example, `PK = TITLE#<titleId>`, `SK = HOLD#<placedAt>#<memberId>` for a hold that a member places on a title.
A GSI with the swapped values puts the same relationship items in the collection of the other entity.

- In a table of one relationship type, AWS uses a dedicated inverse GSI with descriptive keys, for example `byMember` with `memberId` and `titleId`.
- In a shared table, copy the swapped values into `GSI1PK` and `GSI1SK` on the relationship items only. Add the same GSI keys to the other entity's item when a pattern reads it together with its relationships.

Put only fields that do not change on the relationship item. Read the fields that change from the entity items.
See [relationships.md](relationships.md) for the other many-to-many strategies.

## Shared key format for uniqueness

Two entity types that share one namespace can share one key format.
For example, users and organizations both use `ACCOUNT#<name>`. A conditional put of either then fails when the name is in use.
Saving: one uniqueness item and one transaction for each create.
The AWS alternative is a uniqueness item for each name, written in the same transaction. See [writes-and-integrity.md](writes-and-integrity.md).

## Vertical partitioning

A large document with independent parts can become several items under one partition key, one item for each part.
For example, a member's profile, preferences and saved searches each get their own sort key.
One Query reads the whole document. An update writes only the part that changed, and pays for that item's size only.
Use it when the parts change at different times, or when the document can grow past 400 KB.

## When a pre-join does not fit

A pre-join can conflict with the partition design.
For example, a high-volume child type that uses time buckets in its partition key cannot share a partition with its parent.
Then read the parent and the children with parallel requests, and state this in the library.
Two parallel requests are a good result. Two serial requests are the error to avoid.

## The cost of overloaded keys

Overloaded keys have costs. Count them against the saving.

- **Index slots fill up.** An item can be in a few overloaded GSIs only. Each new relationship of that item then needs a new GSI.
- **Sort directions conflict.** Two collections of one partition key format can need different read directions. A new child type then cannot join either.
- **Synthetic keys need backfills.** A new overloaded GSI needs new attributes on existing items. A dedicated GSI on attributes that the items already have builds itself.
- **Encodings make keys hard to read.** Sort-order prefixes, padding and inverted numbers exist only to place a parent in a collection.
- **Exports need work.** Analytics tools expect one entity type for each table. The `Type` attribute makes the split possible.

## Worked example: a library

A library app has members, titles, copies of each title, loans and holds.
The patterns that read several types together are:

- The member page: the member and the member's 20 most recent loans.
- The title page: the title and its copies.
- The hold queue: the title and its holds, oldest first.

The member's holds tab reads holds only.
All entities are restored together and have the same operational needs, so they share one table, `library`.

| Entity       | Partition key               | Sort key                     | GSI keys                            | Notes                                                                               |
| ------------ | --------------------------- | ---------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Member       | `MEMBER#<memberId>`         | `MEMBER#<memberId>`          |                                     | Sorts after its loans. Member page: 1 Query, not 2                                  |
| Loan         | `MEMBER#<memberId>`         | `LOAN#<loanedAt>#<loanId>`   | `loansByCopy`: copyId, loanedAt     | Dedicated GSI: one type, no pre-join needed                                         |
| Title        | `TITLE#<titleId>`           | `TITLE`                      |                                     | Sorts between copies and holds                                                      |
| Copy         | `TITLE#<titleId>`           | `COPY#<copyId>`              |                                     | Title page: 1 Query, `SK <= TITLE`, descending                                      |
| Hold         | `TITLE#<titleId>`           | `WAIT#<placedAt>#<memberId>` | `holdsByMember`: memberId, placedAt | Hold queue: 1 Query, `SK >= TITLE`, ascending                                       |
| Member email | `EMAIL#<email>`             | `EMAIL#<email>`              |                                     | Uniqueness item, written with the member in one transaction                         |
| Hold marker  | `HOLD#<titleId>#<memberId>` | `HOLD#<titleId>#<memberId>`  |                                     | One hold for each member and title. In its own collection, so no read reads past it |

Decisions:

- The member's holds tab reads no other type. A dedicated GSI serves it, and an overloaded GSI would save nothing.
- `COPY` sorts before `TITLE`, and `WAIT` sorts after it. Thus, the title sits in the middle, and each of its two relationships reads from it in one direction.
- Holds use `placedAt` in the sort key, because the queue order is the order of placement and a hold never moves.

The query pattern library for this example is in [pattern-library.md](pattern-library.md).

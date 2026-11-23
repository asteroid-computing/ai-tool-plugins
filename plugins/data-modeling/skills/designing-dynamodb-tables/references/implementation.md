# Implementation

Use this file when you write the data access code for a model.
The keys and item shapes of a DynamoDB model are details that the rest of the application must not know.
Thus, keep them in one layer, and give the rest of the application plain objects.

## One data access layer

- Put all DynamoDB calls, key formats and item shapes in one module or package.
- Give each access pattern one function, named for the pattern, for example `listLoansForMember(memberId, month)`.
- Return application objects, not raw items. Remove index attributes and DynamoDB type wrappers in this layer.
- Let this layer alone set and remove index attributes. A caller must not know that an index exists.
- Write each multi-item rule, such as a unique value or a count, as one transaction in this layer.

A key format then changes in one place, and the charts map to the functions one to one.

## Index attributes and application attributes

Keep the two kinds apart.

- Build index attributes, such as `PK`, `SK` and GSI keys, from application attributes.
- Store each value that a key uses as an application attribute too. Never parse a key to read a value back. A key format can then change without a change to its readers.
- Do not use one attribute as the key of two indexes, even when the values are the same today. A later entity can need different values, and the attribute then serves neither index well.

## The Type attribute

Give each item a `Type` attribute with its entity name, for example `Loan`.
A backfill uses it to find the items of one type with a Scan filter.
An export to an analytics system uses it to separate the entity types.
It also makes an item easy to identify when you debug.

## Defaults and validation

DynamoDB does not enforce a schema beyond the key attributes.
The data access layer is the schema.

- Validate each item before a write.
- Give each optional attribute a default value when the layer reads an item without it. This makes a new attribute additive. See [migrations.md](migrations.md).

## Expressions

- Use expression attribute names, such as `#status`, for every attribute name. Many common words are reserved words, for example `status`, `name`, `count` and `date`. Names with a dot or a hyphen need them too.
- Use expression attribute values for every value.
- Check each key condition against sample keys in sorted order. See [sorting-and-pagination.md](sorting-and-pagination.md).

## Object mappers

Prefer the SDK, or a thin helper that only converts types.
A library that maps one class to one table makes a shared table and its key strategies harder to express.
A library that lets you define the keys of each entity is acceptable.

## Tests

- Test each access pattern against DynamoDB Local or a real test table, not against a mock. Conditions, transactions, key order and page boundaries come from DynamoDB itself.
- DynamoDB Local does not reproduce eventual consistency or transaction conflicts. Test a retry on a transaction conflict and a consistent read by checking the requests that the code sends.

## Attribute name length

Attribute names count toward the item size and the storage cost.
Short names, such as `fn` for `firstName`, save storage only for a very large table with small items.
For most tables, use readable names.

## Charts in the repository

Keep the entity chart and the access-pattern chart in the repository's documentation.
Update them in the same change as the code.
A later session can then read the model without reading the data access layer.

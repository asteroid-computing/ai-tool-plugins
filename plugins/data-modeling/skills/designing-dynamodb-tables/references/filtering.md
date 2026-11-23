# Filtering

Use this file when an access pattern returns a subset of items, for example by status, by type or by a range of dates.
In DynamoDB, the keys do the filtering.
A request pays for each item that it reads, not for each item that it returns.
Thus, design the keys so that a request reads only the items that it returns.

## Decision order

Use the first method that serves the access pattern.

1. Partition key.
2. Sort key range.
3. Sort key with more than one value.
4. Sparse index.
5. Filter expression.
6. Filter in the application.

## 1. Partition key

Every Query must give one partition key value.
Put the items that an access pattern reads in one item collection, and use the partition key to select it.
A Scan is the only read without a partition key, and it reads the whole table or index.

## 2. Sort key range

Use a key condition on the sort key to select a range, for example the bookings of a room between two dates.
This works when the sort key holds a value with a meaning, such as a time.

The sort key can also select one entity type in a mixed item collection.
For example, `begins_with(SK, "INVOICE#")` returns the invoices of an account without the other items.
A condition such as `SK <= "ACCOUNT#<id>"`, with the right read direction, returns the items on one side of the parent item.
See [sorting-and-pagination.md](sorting-and-pagination.md).

## 3. Sort key with more than one value

Use this method when an access pattern always gives one value exactly and a range on a second value.
For example: the tickets of a venue with status `OPEN`, created in March.

- **In a GSI**, use a multi-attribute sort key: `status`, then `createdAt`. The Query gives `status = :s AND createdAt BETWEEN :a AND :b`.
- **In a base table or an LSI**, concatenate the values in one string: `OPEN#2026-03-14T09:30:00.000Z`. Put the value with few possible values first, and the range value last. The reverse order mixes the statuses and the condition cannot select one.

A status changes, so put it in a GSI key, not in a base table key. See [keys-and-indexes.md](keys-and-indexes.md).
A design with the status in the key can return an exact page size with `Limit`, because every item that the Query reads matches.

## 4. Sparse index

An item enters a GSI only when it has all the key attributes of the GSI.
Use this to make an index that holds only the items that match a condition.

- **A subset of one entity type.** Set the GSI key attributes only on matching items. For example, set them only on unread notifications. Remove them when the notification is read, and DynamoDB removes the item from the index.
- **All items of one type.** Set the GSI key attributes only on one entity type. A Scan of that GSI then reads only that type. Use this for a rare job that must visit every item of a type, such as a monthly export of members. Do not put other entity types in this index.

Let the data access code alone set and remove these attributes. See [implementation.md](implementation.md).

## 5. Filter expression

A filter expression removes items after DynamoDB reads them.
Know these facts before you use one:

- The request pays for every item that it reads, including the removed items.
- DynamoDB stops a page at 1 MB of read data, before the filter. A page can return no items and still have more pages.
- `Limit` counts the items read, not the items returned. Thus, a filter makes the page size unpredictable.

Use a filter expression only in these cases:

- Most of the items read match the filter. As a guide, at least one item in three.
- The item collection is small, so the waste is small, for example less than 100 KB.
- It removes items whose TTL time has passed but which DynamoDB has not deleted yet. TTL deletion can take days.

Write the reason in the notes of the access-pattern chart.
Measure the read cost in production.
If the filter wastes capacity, move the condition into a key. See [migrations.md](migrations.md).

## 6. Filter in the application

Read the whole item collection and filter or sort it in the application or the browser.
Use this method when the collection is small, for example less than 1 MB, and the user needs many filter and sort combinations.
It also fits a condition that a key cannot express, such as free gaps in a calendar.
Do not use it on a collection that grows without a limit.

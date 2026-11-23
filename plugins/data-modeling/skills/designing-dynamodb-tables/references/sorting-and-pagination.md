# Sorting and pagination

Use this file when an access pattern returns items in an order, returns the latest N items, or returns a list in pages.
DynamoDB sorts items only by the sort key, and only in one item collection.
Thus, put the order that an access pattern needs into a sort key.

## Contents

- Sort order rules
- Times
- Unique identifiers that sort by time
- Values that change
- Read direction and the parent item
- Two relationships in one item collection
- Numbers in string keys
- Pagination

## Sort order rules

- A Number sort key sorts by its numeric value.
- A String or Binary sort key sorts by its UTF-8 bytes, one byte at a time, from the left.
- In bytes, `#` sorts before digits, digits sort before uppercase letters, and uppercase letters sort before lowercase letters.

Thus, `Zeta` sorts before `alpha`, and `10` sorts before `9`.
Use one letter case in each key, and store the original text in an application attribute.

## Times

Store each time in a key in one format with a fixed width, in UTC.

- **String**: ISO 8601 with a fixed number of fraction digits, for example `2026-03-14T09:30:00.000Z`. It is readable when you debug.
- **Number**: epoch seconds or epoch milliseconds.

Do not use a format that removes trailing zeros from the fraction. Some standard formats do this, and the width then changes, so the order is wrong.
Do not use a local time or a display format, such as `14 Mar 2026`.
Use the same format and type for a value in every item, because a string and a number with the same value are not equal.

## Unique identifiers that sort by time

Use an identifier that starts with a time, for example a ULID, a KSUID or a UUID version 7.
One value then gives both uniqueness and time order.
Use it as the sort key for "latest N" access patterns.
If the order between two items in the same millisecond matters, do not trust the identifier for it.

## Values that change

Do not put a value that changes in a base table sort key, for example a last-update time or a score.
DynamoDB cannot update a key attribute.
Put the value in a GSI sort key.
When the value changes, DynamoDB moves the index entry.

## Read direction and the parent item

A Query reads in ascending order by default.
Set `ScanIndexForward` to false to read in descending order.
For "latest N", read in descending order with `Limit` set to N.

When a parent and its children share an item collection, place the parent where the read starts:

- **Children newest first**: give the children sort keys that sort before the parent. For example, prefix the child sort key with `#`. Read in descending order from the parent with `SK <= <parent SK>` and `Limit` N + 1. The first item is the parent, and the next N items are the newest children.
- **Children oldest first, or in name order**: give the children sort keys that sort after the parent. Read in ascending order from the parent with `SK >= <parent SK>`.

Write sample keys in sorted order and check each Query against them.
An error in the order of a prefix is easy to make and hard to see.

## Two relationships in one item collection

One item collection can hold two child types: one type before the parent, and one type after it.
For example, an account item with its statements before it, read in descending order, and its members after it, read in ascending order.
This works only when one child type is read in descending order from the parent, and the other in ascending order.
If both child types need the same direction, put one of them in a GSI.

## Numbers in string keys

Pad a number in a string key with zeros to a fixed width, for example `00042`.
Choose a width that holds the largest value you can expect, then add two or three digits.
Add an alarm when a value reaches a part of the maximum, for example 30%.

To read numbers in descending order with an ascending read, store the difference from the maximum: for width 5, store `99999 - n`, padded.
This is rarely necessary. Use it only when one item collection must return two child types in the same order.

In a GSI with multi-attribute keys, use a Number attribute. It needs no padding.

## Pagination

Page a list by key, never by offset.
An offset reads and pays for every item that it skips.

- Return `LastEvaluatedKey`, or the key of the last item, to the client as an opaque cursor. Encode it, for example as base64 of JSON.
- To get the next page, pass the cursor as `ExclusiveStartKey`, or use it as the bound of the key condition.
- When you decode a cursor, check that it belongs to the same item collection as the request. Otherwise, a client can read a different collection.
- Only a missing `LastEvaluatedKey` shows the last page. A page can have no items and still have a `LastEvaluatedKey`.
- To get the previous page, read in the opposite direction from the first item of the current page.
- A URL can hold the cursor as a value from the item, for example `?before=<orderId>`, if that value is not secret.

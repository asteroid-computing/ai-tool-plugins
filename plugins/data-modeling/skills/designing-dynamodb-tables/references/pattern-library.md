# Query pattern library

Use this file for step 8: write the entity chart and the query pattern library.
The library records each access pattern and the exact request that serves it.
It is the contract between the data model and the code: it states how each entity is designed to be read and written.
It stays useful after the design is complete, because each new feature starts from it.

## Contents

- What the library holds
- Where it lives
- Read entries
- Write entries
- Rules
- Example: the library app

## What the library holds

Keep these artefacts together, in this order:

1. **Entity-relationship list.** Each entity, its main attributes, and each relationship with its type. A diagram is optional.
2. **Operational needs.** For each table: restore, streams, TTL, encryption, capacity mode. Mark each assumed value.
3. **Entity chart.** One row for each item type, as in SKILL.md, and one chart for each overloaded GSI.
4. **Read patterns.** One row for each read.
5. **Write patterns.** One row for each write, including each transaction.
6. **Decisions.** Each choice that a reader could question, with its alternative and the saving.

## Where it lives

Keep the library in the repository, next to the data access code, for example `docs/data-model.md`.
If the project already has a data model document, add the library to it.
In an answer with no repository, give the library in full in the answer.

## Read entries

| Column            | Content                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| #                 | `R` and a number, which never changes. A removed pattern keeps its number, marked as removed. |
| Pattern           | What the caller asks for, in plain words.                                                     |
| Function          | The name of the data access function that serves it, for example `getMemberWithLoans`.        |
| Inputs            | The values that the request has. Each key value must come from these.                         |
| Request           | The operations and how they run, for example `1 Query`, or `GetItem + Query, parallel`.       |
| Target            | The table, or the table and the index.                                                        |
| Key and condition | The exact key condition, with key formats. Add the filter expression, if any.                 |
| Order and limit   | Read direction, `Limit`, and how the next page starts.                                        |
| Returns           | The entity types and the number of items.                                                     |
| Peak/s            | Peak requests each second. Write "unknown" and ask, if no one knows.                          |
| Units             | Read units for each call, from the item sizes and the consistency.                            |
| Notes             | Consistency, the authorization check, and any reason for more than one request.               |

## Write entries

| Column        | Content                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| #             | `W` and a number.                                                                                       |
| Pattern       | What the caller changes, in plain words.                                                                |
| Function      | The data access function, for example `placeHold`.                                                      |
| Inputs        | The values that the request has.                                                                        |
| Request       | The operation: `PutItem`, `UpdateItem`, `DeleteItem` or `TransactWriteItems`, with the number of items. |
| Items written | Each item, with its key format.                                                                         |
| Conditions    | The condition expression on each item, and the error that a failed condition gives to the caller.       |
| Peak/s        | Peak requests each second.                                                                              |
| Units         | Write units for each call, including GSI writes. A transaction costs double.                            |
| Notes         | Copies that the write must update, the retry behaviour, and the update path of each copy.               |

## Rules

- **Each data access function serves one library entry**, and the entry names it. Code that reads or writes the table outside these functions is an error.
- **A new access pattern enters the library first.** Do steps 2 to 9 of SKILL.md for it, then write the code.
- **A review compares the code with the library**: each key format, each condition, each read direction.
- **The units column uses real item sizes.** Estimate each entity's size from its attributes, and mark each guess.
- **Write a small script for each complex read**, such as a GSI Query with a sort key condition. It takes the inputs, calls the data access function and prints the result, which helps to debug the pattern.

## Example: the library app

This example uses the table from the worked example in [single-table-patterns.md](single-table-patterns.md).
Item sizes are estimates: member 1 KB, loan 300 B, title 2 KB, copy 200 B, hold 200 B.

Read patterns:

| #   | Pattern             | Function           | Inputs           | Request | Target                   | Key and condition                                   | Order and limit                  | Returns           | Peak/s | Units   | Notes                                       |
| --- | ------------------- | ------------------ | ---------------- | ------- | ------------------------ | --------------------------------------------------- | -------------------------------- | ----------------- | ------ | ------- | ------------------------------------------- |
| R1  | Member page         | getMemberWithLoans | memberId         | 1 Query | library                  | PK = `MEMBER#<memberId>`, SK <= `MEMBER#<memberId>` | Descending, limit 21             | Member, 20 loans  | 40     | 1 RCU   | Eventually consistent. Caller is the member |
| R2  | More loans          | listLoans          | memberId, before | 1 Query | library                  | PK = `MEMBER#<memberId>`, SK < `LOAN#<before>`      | Descending, limit 20             | 20 loans          | 5      | 1 RCU   | `before` is the last loan's sort key        |
| R3  | Title page          | getTitleWithCopies | titleId          | 1 Query | library                  | PK = `TITLE#<titleId>`, SK <= `TITLE`               | Descending, no limit             | Title, its copies | 200    | 1.5 RCU | Copies are bounded at 50                    |
| R4  | Hold queue          | getHoldQueue       | titleId          | 1 Query | library                  | PK = `TITLE#<titleId>`, SK >= `TITLE`               | Ascending, limit 51              | Title, 50 holds   | 10     | 1.5 RCU | Staff only                                  |
| R5  | Member's holds      | listHoldsForMember | memberId         | 1 Query | library, `holdsByMember` | memberId = :m                                       | Descending on placedAt, limit 20 | 20 holds          | 20     | 0.5 RCU | GSI is eventually consistent                |
| R6  | Copy's loan history | listLoansForCopy   | copyId           | 1 Query | library, `loansByCopy`   | copyId = :c                                         | Descending on loanedAt, limit 20 | 20 loans          | 2      | 1 RCU   | Staff only                                  |

Write patterns:

| #   | Pattern         | Function     | Inputs                    | Request                     | Items written                                                                                                               | Conditions                                                                                                                 | Peak/s | Units               | Notes                                                                                     |
| --- | --------------- | ------------ | ------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------- | ----------------------------------------------------------------------------------------- |
| W1  | Register member | createMember | member, email             | TransactWriteItems, 2 items | `MEMBER#<memberId>`; `EMAIL#<email>`                                                                                        | `attribute_not_exists(PK)` on both. Failure on the email item: email in use                                                | 1      | 4 WCU               | Email is lowercase in the key                                                             |
| W2  | Place hold      | placeHold    | memberId, titleId         | TransactWriteItems, 3 items | Hold `TITLE#<titleId>`, `WAIT#<placedAt>#<memberId>`; marker `HOLD#<titleId>#<memberId>`; update of the title's `holdCount` | Marker: `attribute_not_exists(PK)`, and a failure means the member already holds this title. Title: `attribute_exists(PK)` | 5      | 8 WCU + 1 GSI write | The hold's key contains a time, so the marker enforces one hold for each member and title |
| W3  | Check out copy  | checkOutCopy | memberId, copyId, titleId | TransactWriteItems, 2 items | Loan `MEMBER#<memberId>`, `LOAN#<loanedAt>#<loanId>`; update of the copy's `onLoanTo`                                       | Loan: `attribute_not_exists(PK)`. Copy: `attribute_exists(PK) AND attribute_not_exists(onLoanTo)`                          | 10     | 4 WCU + 1 GSI write | A failed copy condition means the copy is on loan                                         |

# The inventory

Every decision in every ADR, including each dated amendment, is classified before any rules file is written.
The owner settles each classification; the agent recommends.

## The three classes

- **Live rule**: the code does it today, and future work must keep doing it.
  It becomes a rule in a rules file.
  Example: "the sync loop is the only writer of calendar data", which every new handler must respect.
- **History**: why something was chosen, the options that were rejected, a migration that is finished, or a fact about a moment that has passed.
  It stays in git, in the issues and PRs, and in the ADR's last commit; it does not move.
  Example: "we chose DynamoDB over SQLite because …", once DynamoDB is simply what the code uses; the live part, if any, is the constraint ("DynamoDB is the source of truth"), not the comparison.
- **Superseded**: a later decision or amendment replaced it, or the code no longer does it.
  It does not move; the decision that replaced it is classified on its own.
  When the code and the ADR disagree, that is not superseded by default: it is a question for the owner (is the code wrong, or the ADR?), and the answer may need a fix issue.

Many decisions split: a live constraint, wrapped in history.
Classify the parts separately and keep only the constraint as the rule; the reason it holds becomes its "Because".

## How to build it

1. List every ADR, and every numbered decision and dated amendment inside it.
2. For each, find where the code keeps it, at the source: the package, function or test that implements it, with `git grep` and by reading the code.
   A decision with no code that keeps it is history, superseded or not built yet; say which you think and why.
3. Find its links: the issues and PRs it cites, and the PR that implemented it (`git log -S '<identifier>'`, `gh pr list --state merged --search '<words>'`).
   Never link to the ADR itself, because it will be deleted; link the issues and PRs.
4. Propose an area for each live rule: the part of the code it governs, which will be one rules file with its `paths:` globs.
   Areas follow the code's own boundaries (a package or a group of packages, the web pages, the CI tooling), not the ADRs' numbering.
5. Note what is not in any ADR but is clearly a live rule in AGENTS.md or the code: it belongs in the same rules files, and the owner confirms it like the rest.

## Where it lives

The inventory is an epic issue, because the issue is the brief: a session that has never seen this conversation can do each later PR from it.
Title it "ADR inventory: …", so that step 0 finds it later, write it with the repository's brief template, and put the inventory in its Context as a table:

| ADR  | Decision                               | Class (recommended)           | Area    | Kept by                 | Links  | Why this class                                          |
| ---- | -------------------------------------- | ----------------------------- | ------- | ----------------------- | ------ | ------------------------------------------------------- |
| 0001 | 3: one long-running process            | Live                          | `serve` | `cmd/app/serve.go`      | #N, #M | every loop assumes it                                   |
| 0002 | 7 (amended YYYY-MM-DD): the night view | Split: live rule + history    | `web`   | `internal/web/night.go` | #N     | the window rule holds; the colour comparison is history |
| 0002 | 9: poll every 30 s                     | Superseded by 0004 decision 2 |         |                         | #N     | the poller now uses push                                |

The rows above are illustrative; every real row names a real ADR, real code and real links.

Give each row a recommendation and its reason in a few words, so the owner can agree to most rows at once and argue only the ones that matter.
For a long inventory, present it to the owner one ADR at a time.

## The owner settles it

- Present the inventory, ask the owner to confirm or change each row's class and area, and stop.
- Write the owner's answers into the epic's Decided section in words with the date, for example `- ADR NNNN decisions N–M are live rules for <area>; decision K is history (owner, YYYY-MM-DD).`
- Then write one brief issue per area for step 5, each linking the epic and listing its rows, and one per package or area for step 6.

Nothing in step 5 starts until the owner has settled the rows that area needs.

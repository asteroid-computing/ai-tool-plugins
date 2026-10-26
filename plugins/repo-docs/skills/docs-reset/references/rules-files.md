# Rules files

The rules that apply now live in `.claude/rules/<area>.md`, one file per area.
Claude Code loads a rules file with a `paths:` field when a session reads or edits a file that matches one of its globs, and loads a rules file without `paths:` in every session ([Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)).
So a session working on an area sees that area's rules without reading AGENTS.md's pointers, and a session elsewhere does not pay for them.

## The shape

Start from [`templates/rule.md`](../templates/rule.md):

```markdown
---
paths:
  - "internal/eventlog/**"
---
# The event log

## The log is append-only and compacts safely

The log is compacted into `snapshot.json` when the app starts and whenever the log passes 1 MB: the snapshot is written to a temporary file, synced and renamed over the old one, and then a new log begins.
Because a crash at any step must lose nothing.
Links: owner/repo#241.
```

- **`paths:`** lists the globs the area covers, relative to the repository root; `paths` is the only frontmatter field Claude Code reads from a rule, and frontmatter that does not parse makes the rule load everywhere ([Rule frontmatter reference](https://code.claude.com/docs/en/memory#rule-frontmatter-reference)).
  Leave `paths:` out only for a file that truly applies to every path; AGENTS.md is usually the better home for that.
- **The `#` title** names the area; each **`##` heading** is the rule itself, stated as a fact ("The LAN view is read-only"), so the headings alone read as the area's rules.
- **The statement**: what holds, in as many sentences as the reader needs to keep it, with the names of the files, functions, flags and values involved.
- **One "Because" sentence**: the reason the rule holds now, which a reader needs to apply it to a case it does not name.
  It is the one place the project's "why" is written.
  It is a reason, not a history: "Because a crash at any step must lose nothing", never "Because in March we lost a log".
- **Links**: the issues and PRs behind the rule, as `owner/repo#N` or URLs, so the history is one click away.
  Never link an ADR, a decision number, a question ID or a notes folder, because those are deleted or cannot be opened.
- A procedure ("How to add a component") may be a list under its own heading, without a "Because".

## Writing them

- One PR per area, closing one brief issue from the inventory epic; a small area may share a PR with its neighbour if the owner agrees.
- Each rule comes from the inventory rows the owner settled for that area, checked again against the code at the source: a rule the code does not keep is a question for the owner, not a rule.
- Write what holds now, in the present tense, once.
  No "as amended", no dates in the rule, no "previously", no "from version 2": the rule is edited in place, and git is its history.
- Keep each rule to what a session must know to keep it; the code and its comments say the rest.
- The PR body names the ADR decisions each rules file replaces, so `git log` connects the rule to the decision it came from after the ADRs are deleted.
- When a rule in AGENTS.md belongs to one area, move it into that area's file and leave a one-line pointer in AGENTS.md if every session still needs to know it exists.

## Changing a rule later

- A rule changes in the PR that changes the code it governs, as an edit in place, with its links extended by that PR's issue.
- The change is listed in the hand-back as a choice for the owner, and the owner's answer goes in the issue's Decided section.
- A rule that no longer holds is deleted, not marked as superseded.

## Checks for a rules PR

- Every `paths:` glob matches at least one file: `git ls-files '<glob>'` for each.
- Every rule has a "Because" sentence and at least one link, unless it is a procedure.
- Every link opens and is the issue or PR the rule names.
- No rule cites an ADR or a decision number, and none tells a history.
- Every inventory row for the area is in the file, or was settled by the owner as history or superseded.

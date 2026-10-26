# AGENTS.md

AGENTS.md (or CLAUDE.md, when the repository has no AGENTS.md) holds what applies everywhere; the rules files hold what applies to one area.
Claude Code's documentation recommends under 200 lines per instruction file, and moving what matters to only part of the code into path-scoped rules ([How Claude remembers your project](https://code.claude.com/docs/en/memory)).
Keep the repository's own sections (layout, tooling, PRs and commits, working in a session) and change only what the reset needs.

AGENTS.md changes twice: in step 1, to stop the drift, and in step 7, when the ADRs are retired.

## Step 1: stop the drift

Add a "Where things are written" section near the top, adapted from [orca's](https://github.com/asteroid-computing/orca/blob/main/AGENTS.md):

```markdown
## Where things are written

- **The code and its comments say what the code is and does.**
  Never why it was chosen, its history, or who decided it.
- **`.claude/rules/<area>.md` holds the rules that apply now**, one file per area, which load when a session works on that area's paths.
  Each rule is a statement, one sentence that starts "Because", and links to the issues and PRs behind it.
  A rule is edited in place, and git is its history.
- **An issue is the brief for one piece of work** (`.github/ISSUE_TEMPLATE/brief.md`), and the project board is the order.
- **A decision is written where it applies:** an answer for one issue goes in that issue's Decided section, in words with the date; a lasting rule is an edit to its `.claude/rules` file once the code exists; direction not yet built goes in its epic's Decided section.
- **This file** holds what applies everywhere.
```

While the ADRs still exist, add the precedence lines from [where-decisions-go.md](where-decisions-go.md#while-the-adrs-still-exist), and change every line that says a decision is recorded as an ADR amendment.

Add the comment rule to the rules for all work, because the reviewer's check alone is too late: in obby, sessions kept adding issue citations to new comments while AGENTS.md did not forbid them.

```markdown
- **Comments say what, for the reader of the code** (https://go.dev/doc/comment).
  A package comment says what the package is for and how its parts fit together.
  A symbol's comment says what a caller needs: what it returns or does, its special cases, its units and whether it is safe for concurrent use.
  A comment in a function body explains a step that is not obvious from the code.
  No comment cites an ADR, an issue, a PR, a decision or a question, and none tells the history; an external fact the code depends on (for example `golang/go#22682`) may be named.
```

For a repository not written in Go, cite the language's own documentation guide next to go.dev/doc/comment, or the Google style guide for that language.

## Step 7: retire the ADRs

In the PR that deletes the ADR directory:

- **"There are no ADRs."** as its own line under "Where things are written", with: "A decision that sets a lasting rule becomes a rule; a decision for one issue goes in that issue's Decided section."
- **A short "Architecture" list**: only the constraints that bind every change, whatever area it touches, such as the processes that run, where state is kept, what is never stored or logged, and the one place child processes run.
  Each is one bullet of a sentence or two; a constraint that binds one area goes in that area's rules file instead.
  Orca's has seven.
- **Pointers to the rules files**, where a rule for all work has its detail in one area: "**Nothing in a deploy writes the table** (`.claude/rules/tasks.md`)", as ilttu does, and the layout naming `.claude/rules/` with one line.
- **No ADR left**: remove every mention of `docs/adr`, ADR numbers and decision numbers from AGENTS.md, CLAUDE.md, the README, the reviewer and the issue template; a remaining rule that cited "decision 12" says what decision 12 said.
- **Under 200 lines**, by moving area detail into rules files rather than by cutting rules.

The PR's body lists each section of AGENTS.md that moved and where it went, so a reviewer can check that nothing was lost.

## The orchestrator's config

If the repository has `.claude/orchestrator.json` and the orchestrator skill, nothing in it changes; the skill already writes issues as briefs and records answers where AGENTS.md says.

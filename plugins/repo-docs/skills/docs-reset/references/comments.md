# Code comments

The rule this skill writes into AGENTS.md and checks in every PR:

> Doc comments say what the code is and does, for anyone using it.
> Other comments explain why the code does what it does where its names cannot, and never restate what it does.
> No comment cites an issue, PR, ADR or decision, or tells the history; the reason for a project decision is its rule's "Because".

The first two sentences are the Google Go Style Guide's; the third is what the reset adds.
A citation, a date or a story of what the code used to do explains nothing to a reader of the code, and it goes stale the moment the code changes.

## The sources

Build every comment judgement on these, read at the source; the quotes below were checked on 2026-10-26.
For a repository not written in Go, use that language's own style guide in the same places.

- **[Google Go Style Guide](https://google.github.io/styleguide/go/guide)**, the canonical document:
  - [Clarity: why is the code doing what it does?](https://google.github.io/styleguide/go/guide#clarity-rationale): "It is often better for comments to explain why something is done, not what the code is doing."
    The "why" it means is the code's rationale where names do not carry it: a nuance of the language, a nuance of the business logic, code made intricate for performance, an API that needs care to use.
    It warns that commentary can "obscure the code's purpose by adding clutter, restating what the code already says, contradicting the code, or adding maintenance burden to keep the comments up-to-date".
  - [Simplicity](https://google.github.io/styleguide/go/guide#simplicity): simple code "has comments that explain why, not what, the code is doing to avoid future deviation", and "has documentation that stands on its own".
  - [Maintainability](https://google.github.io/styleguide/go/guide#maintainability): a comment may call attention to a detail that is easy to miss, such as one character that changes a line's meaning.
- **[Decisions: Commentary](https://google.github.io/styleguide/go/decisions#commentary)**, normative:
  - [Doc comments](https://google.github.io/styleguide/go/decisions#doc-comments): "All top-level exported names must have doc comments, as should unexported type or function declarations with unobvious behavior or meaning", as full sentences that begin with the name described, "written for anyone using the package".
  - [Comment sentences](https://google.github.io/styleguide/go/decisions#comment-sentences), [Examples](https://google.github.io/styleguide/go/decisions#examples) and [Package comments](https://google.github.io/styleguide/go/decisions#package-comments), including that "comments intended for maintainers and that apply to the whole file are typically placed after import declarations".
  - [Comment line length](https://google.github.io/styleguide/go/decisions#comment-line-length): see "Line length" below.
- **[Best Practices: Documentation](https://google.github.io/styleguide/go/best-practices#documentation)**: document the error-prone or non-obvious parameters "by saying why they are interesting", context and concurrency behaviour only where it differs from what callers assume, cleanup the caller must do, and the errors a caller can handle; [preview](https://google.github.io/styleguide/go/best-practices#documentation-preview) the rendered documentation; [boost the signal](https://google.github.io/styleguide/go/best-practices#signal-boost) of a line that looks common but is not.
- **[Go Doc Comments](https://go.dev/doc/comment)**, which the style guide and the wiki both defer to for doc comment syntax.
- **[go.dev/wiki/Comments](https://go.dev/wiki/Comments)**: line comments are the norm, packages and exported names have doc comments, and directives are comments that tools read and that a cleanup must not change.

## What each kind of comment holds

- **Doc comments** (package, type, function, method, field, constant): what the thing is and does, and what a user of it needs: its special cases, units, errors, concurrency guarantees and cleanup.
  They do not describe the current implementation.
- **Comments in a function body**: why the code does what it does where its names cannot say it, so a maintainer does not "fix" it: the nuance, the constraint, the trap.
  Write the reason as a fact about the code ("the check is made under the same mutex, so two writers that race cannot both ask"), never as a story ("we added this after the race in March").
  A comment that restates what the next line does is deleted; if the line is unclear without it, the code should be made clearer, which is a code change and outside a comment PR.
- **Maintainer comments for a whole file**, after the imports: the same rule as body comments.
- **External facts the code depends on** may be named, so a reader can open them: a Go issue such as `golang/go#22682`, an RFC section, a vendor's documented limit, as the style guide itself links a Wikipedia section from a comment.

What a comment never holds:

- citations of the project's own records: `(ADR 0004, decision 2)`, `(#285)`, `decision 10`, `see issue 42`, issue and PR URLs, `as amended 2026-10-21`, question or ticket IDs, `(owner, 2026-10-15)`;
- history: "used to", "no longer", "was changed to", "now that", "since the migration", "previously", "the old …";
- provenance: who asked for it, who decided it, which session or PR wrote it;
- the project's reason for a design choice ("because the owner wanted it on the LAN"): that is the rule's "Because"; the comment keeps only what a maintainer of this code needs.

Before and after, from [asteroid-computing/orca#12](https://github.com/asteroid-computing/orca/pull/12):

```diff
-// A Stop hook's "Waiting on AJ" fallback ([SourceFallback]) is asked only if its session has no question open at all, under the same mutex, for the same reason (#260).
+// A Stop hook's "Waiting on AJ" fallback ([SourceFallback]) is asked only if its session has no question open at all, under the same mutex, for the same reason.
-	// Repo is the absolute path of obby's repository; only events from sessions working in it or a directory inside it are kept (decision 10).
+	// Repo is the absolute path of obby's repository; only events from sessions working in it or a directory inside it are kept.
```

The reason stayed ("under the same mutex, for the same reason"); the citations went.

## Line length

The style guide's decisions document says "Long comment lines should be wrapped", with 80 or 100 columns as common choices, and to avoid fitting "large amounts of text onto a single line" ([Comment line length](https://google.github.io/styleguide/go/decisions#comment-line-length)).
Many repositories instead write one sentence per line and never wrap inside a sentence.
This skill imposes neither: follow the repository's own rule, and say in AGENTS.md where that rule differs from the style guide.
A comment PR never rewraps a line it does not otherwise change, because a rewrapped paragraph hides the one word that changed.

## Cleaning a repository's comments

Do this only after the area's rules file has merged (step 5), because a reason a comment loses must already be in the rule's "Because" or be confirmed by the owner as history.
In a Go repository, read [go.md](go.md) first: it has what a cleanup must not touch and the `gocomments` tool that finds the comments and proves a PR changed nothing else.

1. **Find them.**
   In Go, `gocomments find`; in other languages:
   ```bash
   git grep -nE '\bADR[- ]?[0-9]+|\b[Dd]ecisions? [0-9]+|\(#[0-9]+\)|#[0-9]{2,}\b|issues/[0-9]+|pull/[0-9]+|as amended|\b(used to|no longer|previously|for now)\b' -- ':!docs/adr' ':!CHANGELOG.md' ':!.claude/rules'
   ```
   Either way the matches are candidates: read each in context, because only a reader can tell a citation from a fixture.
   Check the comments in templates, CSS, JS, shell and YAML too (`{{/* */}}`, `/* */`, `#`, `<!-- -->`).
2. **Slice it.** One PR per package or area, small enough for a reviewer to read every line, each closing its own brief issue from the inventory epic.
3. **Rewrite, don't just delete.**
   Remove the citation and keep the sentence when it still says what the code is or why it does what it does.
   When a sentence only gave a history or a project reason, say what a maintainer needs instead, or drop it if nothing is lost.
   When a comment names a thing indirectly ("obby's timeouts"), name it directly ("the server's ReadHeaderTimeout").
4. **Change words only.**
   No code, no strings, no test data, no renames, no directives, and no rewrapping (see "Line length").
5. **Verify.**
   - The repository's gate passes.
   - Nothing but comments changed: in Go, `gocomments same origin/main`; otherwise read `git diff` with that question alone.
   - Re-run the search, and list in the PR body each remaining match and why it stays, as orca#12 did: "the remaining matches are the UI word 'decision', test-data numbers and `golang/go#22682`".
   - Say what was not verified, for example a reader's pass over every rewritten package doc.

## Keeping it clean

- AGENTS.md states the rule in its rules for all work (see [agents-md.md](agents-md.md)): a reviewer's check alone comes too late, because sessions write what AGENTS.md allows.
- The reviewer checks every new or changed comment in each PR (see [pr-reviewer.md](pr-reviewer.md)).

# Code comments

The rule this skill writes into AGENTS.md and checks in every PR:

> Doc comments say what the code is and does, for anyone using it.
> Other comments explain why the code does what it does where its names cannot, and never restate what the code already says.
> Every comment is about the code it sits on and stays true for as long as that code is unchanged: so no comment cites an issue, PR, ADR or decision, tells the history, or holds a TODO; the reason for a project decision is its rule's "Because", and work still to do is an issue.

The first two sentences paraphrase the Google Go Style Guide: doc comments are for the package's users, and other comments explain why, not what ([The sources](#the-sources)).
The third is what the reset adds, and its test decides every case the word lists below do not.
A citation, a date or a story of what the code used to do is about the project, not the code: it explains nothing to a reader of the code, and it goes stale the moment the code changes.
Google's code review guide, which is not one of these sources, says comments may hold "the reasoning behind a decision"; the reset moves the project's reasoning into rules files instead, with links, because a comment cannot link to a discussion that stays current.

## The test

A comment is about the code it sits on, and stays true for as long as that code is unchanged.

| Comment                                                                          | By the test                                       | So                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------ |
| "the check is made under the mutex, so two writers that race cannot both append" | true while the code stands                        | stays                          |
| "see golang/go#22682", an RFC section, a vendor's documented limit               | an external fact the code depends on              | stays                          |
| "(decision 10)", "(#285)", "(owner, 2026-10-15)", "as amended"                   | about the project's process, not the code         | goes; the rule's links hold it |
| "used to", "was changed to", "since the migration"                               | true of the past, not of the code                 | goes                           |
| "we chose DynamoDB over SQLite because …"                                      | about the project, not this code                  | goes to the rule's "Because"   |
| `TODO(name): handle retries`                                                     | about work not done, which the code does not hold | goes; it is an issue           |

## The sources

Build every comment judgement on these, read at the source; the quotes below were checked on 2026-10-26.
For a repository not written in Go, use that language's own style guide in the same places.

- **[Google Go Style Guide](https://google.github.io/styleguide/go/guide)**, the canonical document:
  - [Clarity: why is the code doing what it does?](https://google.github.io/styleguide/go/guide#clarity-rationale): "It is often better for comments to explain why something is done, not what the code is doing."
    The "why" it means is the code's rationale where names do not carry it: a nuance of the language, a nuance of the business logic, code made intricate for performance, an API that needs care to use.
    It warns that commentary can "obscure the code's purpose by adding clutter, restating what the code already says, contradicting the code, or adding maintenance burden to keep the comments up-to-date".
  - [Clarity: what is the code actually doing?](https://google.github.io/styleguide/go/guide#clarity-purpose): where a reader may need prior knowledge, it can help to "add additional commentary" or "break up the code with whitespace and comments"; so a comment that says what an intricate sequence or a regular expression does is allowed, and only a comment that restates what the code already says is clutter.
  - [Simplicity](https://google.github.io/styleguide/go/guide#simplicity): simple code "has comments that explain why, not what, the code is doing to avoid future deviation", and "has documentation that stands on its own".
  - [Maintainability](https://google.github.io/styleguide/go/guide#maintainability): a comment may call attention to a detail that is easy to miss, such as one character that changes a line's meaning.
- **[Decisions: Commentary](https://google.github.io/styleguide/go/decisions#commentary)**, normative:
  - [Doc comments](https://google.github.io/styleguide/go/decisions#doc-comments): "All top-level exported names must have doc comments, as should unexported type or function declarations with unobvious behavior or meaning", as full sentences that begin with the name described, "written for anyone using the package".
  - [Comment sentences](https://google.github.io/styleguide/go/decisions#comment-sentences), [Examples](https://google.github.io/styleguide/go/decisions#examples) and [Package comments](https://google.github.io/styleguide/go/decisions#package-comments), including that "comments intended for maintainers and that apply to the whole file are typically placed after import declarations".
  - [Comment line length](https://google.github.io/styleguide/go/decisions#comment-line-length): see "Line length" below.
  - Comments the decisions ask for: an ignored error gets "an accompanying comment" that explains why that is safe ([Handle errors](https://google.github.io/styleguide/go/decisions#handle-errors)); an empty `switch` clause gets a comment rather than `break` ([Switch and break](https://google.github.io/styleguide/go/decisions#switch-break)); and inline comments on function arguments are avoided in favour of an option struct or the function's documentation ([Function formatting](https://google.github.io/styleguide/go/decisions#func-formatting)).
- **[Best Practices: Documentation](https://google.github.io/styleguide/go/best-practices#documentation)**: document the error-prone or non-obvious fields and parameters "by saying why they are interesting", context and concurrency behaviour only where it differs from what callers assume, cleanup the caller must do, and the errors a caller can handle; [preview](https://google.github.io/styleguide/go/best-practices#documentation-preview) the rendered documentation; [boost the signal](https://google.github.io/styleguide/go/best-practices#signal-boost) of a line that looks common but is not.
- **[Go Doc Comments](https://go.dev/doc/comment)**, which the style guide and the wiki both defer to for doc comment syntax.
- **[go.dev/wiki/Comments](https://go.dev/wiki/Comments)**: line comments are the norm, packages and exported names have doc comments, and directives are comments that tools read and that a cleanup must not change.

## What each kind of comment holds

- **Doc comments** (package, type, function, method, field, constant): what the thing is and does, and what a user of it needs: its special cases, units, errors, concurrency guarantees and cleanup.
  They do not describe the current implementation.
- **The package comment** sets expectations for the package as a whole; its "why" is what a user needs, such as what the package guarantees and what it does not ("This package does not guarantee bit-identical results across architectures", from [Package comments](https://google.github.io/styleguide/go/decisions#package-comments)).
  The reasoning behind its design moves to a maintainer comment after the imports, if a maintainer of the code needs it, or to the area's rules file, if it is the project's reason.
- **Comments in a function body**: why the code does what it does where its names cannot say it, so a maintainer does not "fix" it: the nuance, the constraint, the trap.
  Write the reason as a fact about the code ("the check is made under the same mutex, so two writers that race cannot both ask"), never as a story ("we added this after the race in March").
  They include the comments the decisions ask for: why an ignored error is safe, what an empty `switch` clause is for, and a short note that boosts the signal of a line that looks common but is not, such as `err == nil`.
  A comment that says what an intricate sequence or a regular expression does stays; a comment that restates what the code already says is deleted, and if the line is unclear without it, the code should be made clearer, which is a code change and outside a comment PR.
- **Maintainer comments for a whole file**, after the imports: the same rule as body comments.
- **External facts the code depends on** may be named, so a reader can open them: a Go issue such as `golang/go#22682`, an RFC section, a vendor's documented limit, as the style guide itself links a Wikipedia section from a comment.

What a comment never holds, each by [the test](#the-test):

- citations of the project's own records: `(ADR 0004, decision 2)`, `(#285)`, `decision 10`, `see issue 42`, issue and PR URLs, `as amended 2026-10-21`, question or ticket IDs, `(owner, 2026-10-15)`;
- history: "used to", "was changed to", "now that", "since the migration", "previously", "the old …";
- provenance: who asked for it, who decided it, which session or PR wrote it;
- the project's reason for a design choice ("because the owner wanted it on the LAN"): that is the rule's "Because"; the comment keeps only what a maintainer of this code needs;
- work still to do: `TODO`, `FIXME`, `XXX` and Go's `BUG(uid):` notes ([go.dev/doc/comment#notes](https://go.dev/doc/comment#notes)), with or without a name; the work is a follow-up issue, and the comment says what the code does now, including what it does not handle.

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
   In Go, `gocomments find`; in other languages, the same pattern, from the skill's `pattern.txt`:
   ```bash
   TOOL="<the path SKILL.md gives>"                                  # set it in every command
   git grep -nE -f "$TOOL/pattern.txt" -- ':!docs/adr' ':!CHANGELOG.md' ':!.claude/rules'
   ```
   The pattern leaves out "used to", which as often means "for" ("can be used to send") as it tells a history, and `&#` HTML entities such as `&#8217;` in strings; read for history by eye.
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
   - Nothing but comments changed: in Go, `gocomments same origin/main`, which compares against the commit where the branch left main; otherwise read `git diff` with that question alone.
   - Re-run the search, and list in the PR body each remaining match and why it stays, as orca#12 did: "the remaining matches are the UI word 'decision', test-data numbers and `golang/go#22682`".
   - Say what was not verified, for example a reader's pass over every rewritten package doc.

## Keeping it clean

- AGENTS.md states the rule in its rules for all work (see [agents-md.md](agents-md.md)): a reviewer's check alone comes too late, because sessions write what AGENTS.md allows.
- The reviewer checks every new or changed comment in each PR (see [pr-reviewer.md](pr-reviewer.md)).

# Go Testing Rules

**Recent additions you may not know about:**

- **Go 1.24:** `(testing.TB).Context()` — auto-cancelled test context.
- **Go 1.25:** `testing/synctest` — synthetic-time package for testing time-dependent code.
- **Go 1.26:** `T.ArtifactDir()` — directory for test output files; `B.Loop()` no longer prevents inlining.

---

## Test Principles

Three qualities, useful as a decision framework when they conflict:

- **Fidelity** — the test fails when the code is genuinely broken.
- **Resilience** — the test does _not_ fail when the code is still correct, just refactored. Test the public API, not internals. Prefer fakes over mocks.
- **Precision** — when the test fails, the message tells you what went wrong without making you read the source.

Prefer verifying **correct output** over **which methods got called**. **Why:** "method X was called twice" is an implementation detail; "the function returned the right answer" is the contract. Tests that assert on interactions break every time an internal refactor changes the call pattern, even when the externally-visible behaviour is unchanged. Test interactions only when the interaction _is_ the contract — message buses where call count matters, observability layers where side effects are the point.

Test the public interface. Don't reach into internals via `package foo` (white-box) tests unless you genuinely need access to unexported helpers. Tests that fail during a behaviour-preserving refactor are **change detectors** — they don't catch bugs, they catch _changes_. Rewrite them against the public surface, or delete them.

---

## Failure Messages

Every failure must be diagnosable without reopening the source file. Standard format: `FuncName(input) = got, want expected` — got before want, function name and inputs included, `%q` for strings so empty strings and trailing whitespace stand out. **Why:** test failures often surface in CI logs or hours later when the author has context-switched. A message that names the function, the inputs, and both values lets the reader form a hypothesis without leaving the log; a bare `mismatch` or `expected true, got false` forces them to find the test file, scroll to the assertion, and figure out what was being checked.

## No Assertion Libraries

Don't use `assert.Equal`, `require.NoError`, or other assertion-library DSLs. Use `cmp.Equal` / `cmp.Diff` with your own `t.Errorf` messages, and include a `(-want +got)` legend in every diff so the diff orientation is unambiguous. Don't use `reflect.DeepEqual` (it compares unexported fields and produces unhelpful failure messages); don't compare serialised bytes (the output stability of `json.Marshal` etc. is not contractual).

**Why no assertion libraries:** they package the comparison and the failure together in a way that hides the inputs. `assert.Equal(t, want, got)` produces "expected 5, got 7" — but you can't tell from the message _what_ should have been 5. Hand-written `t.Errorf("AddTwo(%d) = %d, want %d", input, got, want)` carries the function and its arguments into the failure, which is what makes the test self-diagnosing. They also tend to abort the test on the first mismatch (`require.*`), hiding subsequent failures until the next run.

## t.Error vs t.Fatal

`t.Error` by default — it records the failure but continues, so the test reports _every_ mismatch in one run. `t.Fatal` only when continuing is meaningless (e.g. setup failed and downstream code would dereference a nil result). Never call `t.Fatal` from a goroutine other than the test's own goroutine — `Fatal` calls `runtime.Goexit` on whatever goroutine invokes it, and from a spawned goroutine that doesn't unwind the test, it just kills the spawned goroutine and lets the test continue with a missing failure record.

**Why this distinction matters:** the developer fixing a test wants to see all of its problems at once, not have to fix-rerun-fix-rerun through them. `t.Error` plus `continue` (in table tests without `t.Run`) or just letting flow fall through to the next assertion gives them the full picture in one pass.

## Error Semantics in Tests

Compare errors with `errors.Is` and `errors.As`, not by string-matching `err.Error()`. **Why:** error messages are not contract — the producer can rephrase "not found" to "no such record" between minor versions and break every test that string-matched. Sentinels and typed errors _are_ contract, and `errors.Is`/`errors.As` walk the wrap chain so wrapped errors compare correctly.

---

## Table-Driven Tests

- Use field names in case structs whenever the struct has many fields or adjacent fields of the same type. **Why:** positional `{nil, 0, "foo", true, false}` makes a reader count commas to figure out which `false` they're looking at. Field-name literals (`{wantErr: nil, wantCount: 0, name: "foo", parallel: true, fatal: false}`) make the case readable in isolation.
- Drive subtests with `t.Run` and a descriptive name. Use identifier-style names (`empty_input`, `negative_count`), not prose. **Why:** the name appears in `-run` filters, in CI output, and in benchmark profiles. Prose with spaces and punctuation is awkward to filter and ugly in logs.
- Don't put slashes in subtest names — `/` is the separator that `-run regex/` uses to address nested subtests, so a slash inside a single name confuses the matcher.
- Identify cases by name, not by index. **Why:** "case 3 failed" sends the reader to count rows in the table; "empty_input failed" tells them which case immediately. When a case is later inserted, the index of every subsequent case shifts and old failure logs become misleading.
- Split into separate test functions when cases genuinely need different validation logic. **Why:** a table where half the rows ignore certain `want*` fields, or where some rows need extra setup, is a table that's been forced into uniformity at the cost of clarity. Two focused tests beat one branching one.

## Test Helpers

- Call `t.Helper()` at the top of every helper. **Why:** without it, test failures report the line _inside the helper_ that called `t.Errorf`, not the test that called the helper — and as helpers grow and call other helpers, the failure location becomes useless. `t.Helper()` walks the stack so the reported line is the test's call site.
- Helpers should `t.Fatal` on setup failure rather than returning an error. **Why:** the calling test can't usefully proceed if setup failed, and forcing every test to write `if err := setup(t); err != nil { t.Fatal(err) }` puts boilerplate in every caller. The helper takes `*testing.T` precisely so it can fail directly.
- Helpers do setup and cleanup, not validation. A helper that calls `t.Errorf` to verify an output is an assertion library in disguise — it loses the input/expected context that makes Go test failures self-diagnosing. Validators should return values; the test decides whether to fail.

## Test Packages

- `package foo` (same package, white-box) vs `package foo_test` (separate, black-box): white-box gives the test access to unexported helpers but couples it to internals; black-box exercises only the public API and survives refactors. Default to black-box; use white-box only when there's an unexported helper genuinely worth testing directly.
- Use the standard `testing` package only. No third-party frameworks (Ginkgo, Convey, testify suites). **Why:** custom frameworks fragment the developer experience — every test reader has to learn the framework's idioms, and the framework's failure output replaces Go's standard format. The standard `testing` package, plus `cmp`, plus your own helpers, covers everything without forcing the next developer to learn a new vocabulary.

## Setup Scoping

Scope setup to the tests that actually need it. Don't use `init()` for test-specific setup — `init` runs _unconditionally_ for every test in the package, including tests that don't need the setup, which slows everything down and couples tests that should be independent. Use `TestMain` only when _all_ tests in the package need shared setup with teardown. Use `sync.Once` (or per-test setup helpers) for expensive shared setup that doesn't need teardown.

(There are legitimate uses of `init()` in non-test code — registering codecs, validating env vars at startup. The rule above is specifically about test files.)

---

## Test Context (Go 1.24)

Use `t.Context()` (or `b.Context()`, `f.Context()`) instead of `context.Background()` in tests:

```go
func TestQuery(t *testing.T) {
    ctx := t.Context()
    rows, err := db.QueryContext(ctx, "SELECT 1")
    // ...
}
```

**Why:** `t.Context()` is cancelled automatically when the test ends — including when the test is being shut down because a sibling test failed. Goroutines spawned with this context will exit cleanly when the test exits, which prevents leaks across tests and makes `-race` runs more reliable. With `context.Background()`, a goroutine you forgot to clean up keeps running into the next test and can corrupt its state.

---

## Synthetic Time (Go 1.25)

`testing/synctest` lets a test pretend that time has passed without actually sleeping. The package runs a "bubble" goroutine in which `time.Now`, `time.Sleep`, `time.NewTimer`, and `time.NewTicker` all advance against a virtual clock that's only advanced when every goroutine in the bubble is durably blocked.

```go
import "testing/synctest"

func TestTimeout(t *testing.T) {
    synctest.Run(func() {
        ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
        defer cancel()

        result := make(chan string, 1)
        go func() { result <- doWork(ctx) }()

        // No real sleep happens — the bubble fast-forwards an hour.
        select {
        case r := <-result:
            t.Fatalf("expected timeout, got %v", r)
        case <-ctx.Done():
            // expected
        }
    })
}
```

**Why this matters:** before `testing/synctest`, testing code with timeouts, retries, rate limits, or scheduled work either had to sleep for real (slow tests, occasional flakes) or thread an injectable clock through every API (verbose, leaky abstraction). `synctest` makes time-dependent tests fast and deterministic without changing the production code under test.

**Caveat:** the bubble's "every goroutine blocked" detection has limits — a goroutine spinning on a CPU loop, or one blocked on something outside the synctest world (a real network call, a real `os` syscall), keeps the clock from advancing. Mock or stub external dependencies before reaching for synctest.

---

## Test Artifacts (Go 1.26)

`T.ArtifactDir()` returns a directory for test output files — use instead of manual temp dirs. With `-artifacts` flag, the directory persists; without it, cleaned up automatically.

```go
func TestGenerateReport(t *testing.T) {
    dir := t.ArtifactDir()
    outputPath := filepath.Join(dir, "report.html")
    if err := GenerateReport(outputPath); err != nil {
        t.Fatalf("GenerateReport() = %v", err)
    }
}
```

**Why this is better than `t.TempDir`:** `TempDir` is always cleaned up after the test, so the only way to inspect what a failing test produced is to add `t.Log` calls or set a custom output path. `ArtifactDir` plus `-artifacts` lets the directory persist after a test run, so investigating "what did the test actually generate?" is a `cd` into the artifact directory rather than a re-run with extra logging.

---

## Benchmark Loop (Go 1.26)

`b.Loop()` (introduced earlier as the modern replacement for `for i := 0; i < b.N; i++`) used to disable inlining inside the loop body, which sometimes made benchmark results misleading. Go 1.26 fixed this — `b.Loop()` is now inlining-friendly. **Practical effect:** convert `for i := 0; i < b.N; i++` benchmark loops to `for b.Loop()` without worrying about a performance drop on Go 1.26+.

---

## Integration & Acceptance

- Use real transports with test double servers, not hand-implemented clients.
- Acceptance test packages: separate `packagetest` package, return errors instead of taking `*testing.T`.

# Go Naming Rules

Go names are shorter, context-aware, and avoid repetition. These rules override conventions from other languages.

---

## Package Names

- All lowercase, no underscores, no mixed caps. Typically a single word. **Why:** package names appear at every call site (`json.Marshal`, `bytes.Buffer`); short, single-word names keep call sites readable and let the _exported_ name carry the meaning. `bufio.Reader` reads better than `BufferedIO.Reader`.
- Avoid `util`, `common`, `helper`, `model`, `base`. **Why:** these names describe how the author _organised_ the code, not what the package _does_. A reader who sees `import "myproj/util"` learns nothing about what they're getting; a reader who sees `import "myproj/timefmt"` already knows. If you can't think of a domain-specific name, the package is probably a grab-bag that should be split.
- Don't pick names likely to collide with common local variables (`count`, `path`, `user`). **Why:** when the package name shadows a local, callers either rename the import (annoying) or rename their variables (annoyer). Picking `usercount` over `count` saves everyone friction.
- If only one type is exported and it shares the package name, its constructor is just `New`. So `ring.New` rather than `ring.NewRing` — see "Repetition" below.
- Test packages: `_test` suffix. Renamed imports: follow the same rules and use the same local name across every file in the package.

## Receiver Names

One or two letters that abbreviate the type, used consistently across every method on that type. Don't use `this` or `self`. So `func (t Tray)`, `func (w *ReportWriter)`, `func (s *Scanner)`. **Why:** receiver names carry no information beyond "this is the receiver" — Go knows that already from the syntax. A descriptive name (`receiver`, `self`, `tray`) just adds noise. Consistency across methods matters because grepping for `t.Field` should find every method that touches `Field` on that type, regardless of which method you start in.

## Constants

MixedCaps for everything (exported `MaxRetries`, unexported `defaultTimeout`). Don't use `ALL_CAPS` or `kPrefix` — those are C++/Java conventions that fight with Go's capitalisation-as-visibility rule. Name by **role**, not value: `DefaultTimeout` rather than `ThirtySeconds`. **Why:** the role survives a value change; the value-encoded name becomes a lie the moment someone bumps the timeout.

Use `iota` for enumerations. When zero is meaningless (e.g. status codes where 0 would be misread as "OK"), skip it by assigning the first value to `_`:

```go
const (
    _ Status = iota
    StatusActive
    StatusPending
    StatusClosed
)
```

## Initialisms

Initialisms (`URL`, `ID`, `API`, `XML`) are written all-caps or all-lower — never mixed. So `ID` and `id`, never `Id`; `URL` and `url`, never `Url`; `XMLAPI`, never `XmlApi`. For unexported names where the initialism is the first word, the whole initialism goes lowercase: `xmlAPI`, `id`, `db`. **Why:** mixed-case initialisms collide with `MixedCaps` parsing — a reader scanning `XmlApi` has to decode whether `Xml` and `Api` are two words or one initialism. Keeping each initialism atomic (`XMLAPI`) eliminates the ambiguity.

## Getters and Setters

Don't prefix getters with `Get`. The getter for `owner` is `Owner()`; the setter is `SetOwner()`. When the getter would do non-trivial work (a network call, a cache lookup, a computation), name it after the work — `FetchOwner`, `LoadOwner`, `ComputeOwner` — so callers know it's not a cheap field read.

**Why:** Go uses capitalisation for visibility. The whole point of `Owner` (exported) versus `owner` (unexported) is that the case carries information; `GetOwner` adds a redundant verb without adding meaning. Effective Go: _"If you have a field called `owner` (lower case, unexported), the getter method should be called `Owner` (upper case, exported), not `GetOwner`. The use of upper-case names for export provides the hook to discriminate the field from the method."_

When a getter would collide with an exported field on the same type, unexport the field. Don't add `Get` as a workaround — that's working around the language instead of with it. See `types.md` for the full Input-type pattern (unexported fields + `New*` constructor + `With*` builders + idiomatic accessors).

## Interface Names

One-method interfaces are named by the method plus `-er`: `Reader`, `Writer`, `Stringer`, `Closer`. **Why:** the convention is so well-established that a function parameter named `r io.Reader` immediately tells the reader "this only needs `Read`." Inventing a different naming scheme for your own one-method interface forces readers to look up what it requires.

Don't reuse the canonical method names (`Read`, `Write`, `Close`, `String`, `Error`, `Format`) unless your method has the same signature _and_ the same meaning. **Why:** these names are load-bearing across the standard library — `fmt`, `io`, `encoding/json`, `errors` all dispatch on them via type assertion. A `String() string` that returns something other than a human-readable representation will get printed by `fmt.Sprintf("%v", x)` and produce wrong output everywhere.

---

## Variable Names

- **Length scales with scope.** A variable that lives for 1–7 lines can be a single letter (`i`, `c`, `err`); 8–15 lines wants a short word (`count`, `userID`); 15–25 lines wants a fuller phrase (`userCount`); 25+ lines wants something descriptive enough to read in isolation (`incomingRequestCount`). **Why:** name length is overhead the reader pays at every reference. In a tight loop where the variable is visible everywhere, `i` is clearer than `loopIndex`. In a long function where you encounter `c` thirty lines after its declaration, you've forgotten what `c` is and have to scroll back. Match the cost to the distance.
- **Don't put the type in the name.** `users int`, not `numUsers int` or `usersInt int`. The compiler knows the type; the name is for the _role_. The exception is when two forms of the same value coexist in the same scope (`limitStr` / `limit`), where suffixing by representation is clearer than inventing a synonym.
- **Avoid generic placeholder words** — `data`, `state`, `value`, `manager`, `engine`, `object`, `entity`, `instance`, `helper`, `util`, `broker`, `metadata`, `process`, `handle`. **Why:** a variable named `data` could be anything. Replacing it with `payload`, `message`, `rows`, `bytes` — whatever it actually is — gives every reader the right mental model on first read instead of forcing them to look at how it's used.
- **Don't drop letters.** `Sandbox`, not `Sbx`; `Configuration`, not `Cfg` (well — `cfg` is acceptable as a short-scope local, like `ctx`). **Why:** the savings are illusory; the cost is a name the reader can't pronounce in their head, which slows comprehension. Established short forms (`ctx` for `context.Context`, `req` for `*http.Request`, `w` for `http.ResponseWriter`) are fine because they're idiomatic across the ecosystem — but invented abbreviations aren't.

---

## Repetition — Eliminate It

Every name lives in context — the package, the type, the receiver, the function — and the reader sees that context for free. Don't repeat what context already provides:

| Pattern           | Bad                          | Good                  |
| ----------------- | ---------------------------- | --------------------- |
| Package + symbol  | `widget.NewWidget`           | `widget.New`          |
| Receiver + method | `(c *Config) WriteConfigTo`  | `(c *Config) WriteTo` |
| Type + method     | `(p *Project) ProjectName()` | `(p *Project) Name()` |
| Package + type    | `sqldb.DBConnection`         | `sqldb.Connection`    |

Inside a function, strip context the function name already provides — `func ParseUser` doesn't need a local called `parsedUser`, just `user`.

**Why:** repetition isn't just stylistic clutter; it makes call sites longer and harder to scan. `widget.New(opts)` reads as one thought; `widget.NewWidget(opts)` reads as the reader pausing to wonder whether `NewWidget` differs from some other `New` in the package. The shorter form is also future-proof — if the package later exports a second type, you can add `widget.NewGadget` and the existing `widget.New` still makes sense as "the canonical constructor."

---

## Function and Method Names

- Returns something → noun-like: `JobName`, `Port`, `Children`
- Does something → verb-like: `WriteDetail`, `Process`, `Start`
- Type-differentiating: `ParseInt`, `ParseInt64`. Omit type from the "primary" version.

## Shadowing

Two related-but-distinct things share the `:=` syntax:

- **Stomping** — reusing `:=` in the _same_ scope to reassign at least one existing variable plus declare at least one new one (`x, err := f()` followed later by `y, err := g()`). This is fine and idiomatic; the second `err` is the same variable, not a new one.
- **Shadowing** — `:=` inside a _new_ block (an `if`, `for`, or function literal) creates fresh variables that go out of scope when the block ends. Code after the block uses the original. **Why this is dangerous:** the classic bug is `if ctx, cancel := context.WithTimeout(ctx, ...); ... { ... }` followed by code that uses the _outer_ `ctx` and never gets the timeout. The variable name reads correctly but the wrong instance is in scope. Fix: when you mean to mutate the outer variable, use `=` instead of `:=`, or hoist the declaration above the block.

Don't shadow package names you still need to use. **Why:** `var json = ...` in a file that also imports `encoding/json` is a guaranteed source of confusion; readers see `json.Marshal` and have to check which `json` is in scope.

## Test Double Naming

Helper packages that expose test doubles for a production package conventionally append `test` to the package name (`creditcard` → `creditcardtest`) so the import path stays self-documenting. Inside the helper:

- **Single double type:** name it after the double's _kind_ — `Stub`, `Spy`, `Fake`. Callers write `creditcardtest.Stub`, which reads naturally.
- **Multiple doubles with different behaviours:** name by _behaviour_ — `AlwaysCharges`, `AlwaysDeclines`, `RejectsExpired`. The kind is implied by context.
- **Local variables in tests:** prefix with the kind so a reader skimming the test knows immediately whether they're looking at a real client or a double — `spyCC` instead of `cc`.

Conventional terms (use them rather than inventing synonyms): **Fake** is a working in-memory implementation, **Stub** returns canned responses, **Spy** records calls for later inspection, **Mock** verifies expectations as part of its behaviour. Picking the right word at the API surface saves everyone a `grep`.

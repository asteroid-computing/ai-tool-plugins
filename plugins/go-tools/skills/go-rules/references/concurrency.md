# Go Concurrency Rules

**Go 1.26:** Experimental goroutine leak profiling via `GOEXPERIMENT=goroutineleakprofile`. NOT in your training data.

---

## Core Principle

The headline rule from Effective Go is _"Don't communicate by sharing memory; share memory by communicating"_ — channels are the high-level abstraction Go encourages. **But the same chapter immediately qualifies it:** "Reference counts may be best done by putting a mutex around an integer variable." Use channels when the work is _passing values between concurrent components_; use a mutex when the work is _protecting one piece of state_. A mutex around an integer counter is dramatically simpler than the channel-based equivalent and you should reach for it without guilt.

## Goroutine Lifetimes

When you spawn a goroutine, it must be clear **when and whether it exits**. Every `go f()` is a question: how does this thing stop?

- Goroutines blocked on channels leak — the garbage collector will _not_ reclaim a goroutine just because nothing else references the channel it's waiting on. **Why:** the runtime considers a blocked goroutine alive (it's "doing something — waiting"). Leaks accumulate silently across the lifetime of the process and surface as memory growth that's hard to attribute. Go 1.26's `goroutineleakprofile` GOEXPERIMENT can detect them in tests; turn it on.
- Sending on a closed channel panics. The conventional ownership rule is "the _sender_ closes the channel, never the receiver" — and only one goroutine should be the canonical sender.
- Keep synchronisation code in function scope. Factor business logic into synchronous helpers and add concurrency at the orchestration level. **Why:** when the synchronisation is sprinkled inside the logic, every reader has to mentally simulate the goroutine schedule to follow the code; when it's at the orchestration layer, the inner functions read sequentially.
- Prefer synchronous APIs. The caller can always wrap a sync call in `go`; ripping concurrency _out_ of an async API requires re-implementing the synchronisation.

## Context

- `context.Context` is the _first_ parameter, conventionally named `ctx`. Don't put it in a struct field. **Why:** context carries cancellation, deadlines, and request-scoped values that should follow the call chain, not the lifetime of an object. Storing it in a struct decouples it from the call that should control it, which leads to handlers running long after the request that started them was cancelled. The first-parameter convention is uniform across the standard library — anything else makes the function look out of place.
- Use `context.Background()` only in entrypoints (`main`, `init`, top-level `TestXxx`). In Go 1.24+, prefer `tb.Context()` in tests — it's cancelled when the test ends, which prevents goroutines from leaking past the test.
- Don't create custom context types or interfaces in function signatures. **Why:** the Go ecosystem assumes `context.Context` everywhere; a custom interface forces every conversion across package boundaries to negotiate the type, and tools like `errgroup` and the standard library lose the ability to propagate cancellation.

Exceptions where the context source is established by convention: HTTP handlers (`req.Context()`), streaming RPC methods (`stream.Context()`).

## Channels

Always specify direction in function signatures: `func sum(values <-chan int)` for receive-only, `func produce(out chan<- int)` for send-only. **Why:** a bidirectional `chan int` parameter is a "trust me, I won't send to this receive-only stream" comment; a directional one is a compile-time guarantee. The narrower type also documents ownership — readers know which side of the channel this function is responsible for.

Prefer synchronous APIs over channel-based APIs (a function that returns a value is easier to use than one that hands you a channel to read from). When a channel really is the right abstraction, document the answers to three questions on the receiving end and one on the sending end:

1. Who closes the channel?
2. What happens if the consumer falls behind — does the producer block, drop, or buffer?
3. How does cancellation propagate (typically: `select` between the channel and `ctx.Done()`)?

## Sync Primitives

Never copy `sync.Mutex`, `sync.WaitGroup`, `sync.Once`, `sync.RWMutex`, or any other sync type by value. **Why:** copying a mutex produces two mutexes that don't synchronise with each other — the bug surfaces under concurrency, often on a different machine, and is among the hardest Go bugs to debug. `go vet`'s `copylocks` analyser catches the common cases at compile time; let it. Pass these types by pointer or embed them.

Prefer `sync.Mutex` over channels for simple state protection. **Why:** a counter, a cache, a single shared map — these are protect-this-data problems, not coordinate-these-goroutines problems. A channel-based counter has more moving parts than `var mu sync.Mutex; var n int` and gives readers nothing in return.

---

## Select

`select` lets a goroutine wait on multiple channel operations at once, executing the first one that becomes ready (with a randomised tiebreak when several are ready simultaneously). Three patterns matter:

### Cancellation

Almost every `select` in production code includes a `<-ctx.Done()` case so the goroutine respects cancellation:

```go
select {
case v := <-work:
    process(v)
case <-ctx.Done():
    return ctx.Err()
}
```

**Why:** without this, a goroutine blocked on `<-work` will sit forever even after the request that spawned it was cancelled. Adding the `ctx.Done()` case is what turns a leak-prone receive into a well-behaved one.

### Non-blocking with `default`

A `select` with a `default` case never blocks — if no other case is ready, `default` runs immediately. This is the basis for several patterns:

```go
// Try-send (drop on full):
select {
case ch <- v:
    // sent
default:
    // channel full; dropped
}

// Try-receive (don't wait):
select {
case v := <-ch:
    handle(v)
default:
    // nothing available right now
}

// Leaky buffer / free list:
var freeList = make(chan *Buffer, 100)

func release(b *Buffer) {
    select {
    case freeList <- b:
        // returned to pool
    default:
        // pool full; let GC reclaim
    }
}
```

**Why this pattern is powerful:** it lets you bound resource use (the leaky free-list above) or provide best-effort semantics (drop metrics under load) without locks or extra goroutines. The `default` case is what makes the `select` non-blocking; without it, all of the above would deadlock waiting for capacity.

### Timeouts

`time.After` returns a channel that fires after a duration — combine it in a `select` for a timeout:

```go
select {
case v := <-work:
    return v, nil
case <-time.After(5 * time.Second):
    return zero, errors.New("timed out")
case <-ctx.Done():
    return zero, ctx.Err()
}
```

**Caveat:** `time.After` allocates a timer per call that lives until it fires, even if the `select` exits via another case. In a hot loop, prefer `time.NewTimer` plus `defer t.Stop()` to release the timer eagerly. As of Go 1.23, the timer GC story improved — abandoned timers can be reclaimed sooner — but the explicit-Stop pattern is still cheaper.

---

## Patterns

The standard concurrency patterns — worker pools, semaphores via buffered channels, fan-out with `WaitGroup`, leaky-buffer free lists, channel-of-channels for per-request response — are all idiomatic and well-documented. The non-negotiable invariant: every spawned goroutine's lifetime must be bounded by _something_ — `wg.Wait()`, context cancellation, channel close, or an explicit done-signal channel.

### `errgroup` (golang.org/x/sync/errgroup)

When you have a group of related goroutines that should fail-fast (the first error cancels the rest), `errgroup` is the right tool. It combines a `sync.WaitGroup`, a context, and an error slot:

```go
g, ctx := errgroup.WithContext(ctx)
for _, url := range urls {
    g.Go(func() error {
        return fetch(ctx, url)
    })
}
if err := g.Wait(); err != nil {
    return err  // first non-nil error from any goroutine
}
```

**Why this beats raw WaitGroup:** the `ctx` returned by `WithContext` is cancelled the moment any goroutine returns an error, so the _other_ goroutines stop wasting work on a doomed operation. With raw `sync.WaitGroup`, you'd have to wire up a separate cancellation channel and an atomic error slot yourself — `errgroup` is exactly that, packaged correctly.

`errgroup.Group.SetLimit(n)` (added in 1.18) provides a built-in concurrency cap — `g.Go` blocks if `n` goroutines are already running. Combined with `errgroup.TryGo`, this replaces a lot of bespoke worker-pool code.

**When NOT to use errgroup:** when the goroutines should run to completion regardless of each other's failures (independent tasks where partial success is meaningful). For that, raw `sync.WaitGroup` plus per-goroutine error handling is the right shape.

---

## Leak Detection (Go 1.26)

Go 1.26 adds an experimental goroutine leak profile (`GOEXPERIMENT=goroutineleakprofile`). It detects goroutines blocked on unreachable concurrency primitives using the garbage collector. Enable in tests and CI to catch channel/mutex leaks early.

---

## Misc

- DO NOT recover panics to avoid crashes — use monitoring for unexpected failures.
- Concurrency structures a program; parallelism executes simultaneously. DO NOT hardcode CPU counts — use `runtime.GOMAXPROCS(0)` to query.

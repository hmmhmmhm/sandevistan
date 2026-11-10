# G2 Pipelined Image Transport Experiment Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-30

Status: Approved for implementation

Branch: `experiment/g2-pipelined-transport`

## Goal

Reduce the wall-clock time of G2 page and detail transitions by allowing a
bounded number of `updateImageRawData` calls to remain in flight at once.

The experiment must preserve the proven SDK `0.0.11` renderer, tile geometry,
unchanged-tile cache, input behavior, and no-deferred-refresh policy. It must
not change `main` until physical G2 evidence demonstrates that a pipelined mode
is both faster and stable.

## Baseline

- SDK: `@evenrealities/even_hub_sdk` `0.0.11`
- Frame: one 576×288 Canvas encoded as four 288×144 PNG tiles
- Initial and full-screen order: `3 → 5 → 2 → 4`
- Dashboard page change: right tiles `3 → 5`
- Map change: left tiles `2 → 4`
- Clock or battery change: top-right tile `3`
- Accepted refreshes are fail-fast and never queued, merged, replayed, or
  retried.
- Tiles whose encoded bytes equal the last successful payload are skipped.

## Selected approach

Add a bounded worker pool inside one already accepted refresh.

The pool starts tiles in the existing target order. With concurrency two,
tiles `3` and `5` start first. Whenever one finishes successfully, the next
tile starts in the newly available slot. Completion order may differ from
start order.

The URL query controls only the experimental per-refresh tile concurrency:

```text
?pipeline=1
?pipeline=2
?pipeline=3
```

Missing, malformed, zero, negative, or larger values resolve to `1`. The
stable default therefore remains the existing serial transport.

Concurrency two is the first physical gate. Concurrency three is exposed by
the same bounded implementation but must not be tested until concurrency two
passes startup, page-transition, binocular, failure, and responsiveness gates.

## Alternatives rejected

### Fixed pair barriers

Sending `3` and `5` together, waiting for both, then sending `2` and `4` is simpler.
However, if one tile finishes early, that method leaves a slot idle.
A bounded pool fills the available slot without increasing the concurrency limit.

### All tiles at once

Four concurrent bridge calls provide the largest theoretical reduction but
have no compatibility evidence in SDK `0.0.11`. They increase the risk of
`sendFailed`, missing quadrants, host-bridge overload, and an unresponsive
WebView. This experiment intentionally caps the supported values at three.

### Refresh request pipeline

Only tiles inside one accepted refresh may overlap. Independent clock,
battery, location, page, and input refresh requests remain protected by the
existing single busy gate and are dropped immediately while busy.

## Components

### Concurrency resolver

A small pure module parses the `pipeline` query value and returns the literal
type `1 | 2 | 3`. The application resolves it once and passes it explicitly
through the HUD controller and `FastCanvasOptions`.

### Bounded tile runner

A transport-independent helper receives the encoded tiles, the concurrency
limit, and an asynchronous tile callback. It:

1. starts items in array order up to the limit;
2. starts the next item when a slot becomes available;
3. records the first failure and starts no additional item after that failure
   is observed;
4. waits for already in-flight work to settle;
5. rejects with the first error.

The helper owns no timer, retry, refresh queue, cache, bridge, or Canvas state.

### Raster transport

`fast-canvas-transport.ts` uses the bounded runner for its encoded target
tiles. The existing SDK call, per-tile 12-second timeout, result
normalization, success-only byte cache, unchanged skip, and page rollback
remain in the tile callback.

Diagnostic output adds:

- the configured pipeline limit at transport startup;
- the current SDK image-call count on each tile start;
- the configured limit on each tile start;
- the existing per-tile duration;
- the existing complete refresh duration and sent/skipped counts.

## Failure semantics

- A failed tile never updates its successful-payload cache entry.
- A successful peer updates only its own cache entry.
- Once a failure is observed, no additional encoded tile starts.
- Already in-flight calls are allowed to settle because the SDK exposes no
  cancellation API.
- The accepted refresh fails after all active calls settle.
- Page state uses the existing logical rollback.
- No compensating image send, retry, pending target, latest-value slot, or
  deferred operation is created.
- The next independent event may render and transmit the current logical
  state normally.

## Automated verification

All tests run serially.

The pure runner must prove:

- default concurrency one never overlaps callbacks;
- concurrency two and three never exceed their limits;
- start order matches input order;
- a free slot starts the next item without a pair barrier;
- the first failure prevents later items from starting;
- already active items settle before rejection.

Transport integration must prove:

- the default URL and invalid values remain serial;
- concurrency two overlaps at most two SDK calls;
- concurrency three overlaps at most three SDK calls;
- two-tile page refreshes can overlap both calls;
- four-tile refreshes retain start order `3 → 5 → 2 → 4`;
- unchanged tiles do not consume SDK in-flight capacity;
- partial success and failure preserve the existing per-tile cache contract;
- refresh requests received while the pipeline is active are still dropped;
- no automatic retry occurs.

The full repository type, source, Node, Sites, build, and packaging gates must
pass without changing the SDK version.

## Physical G2 gate

Use the same phone, Even app, glasses state, and HUD content for each run.

1. Record `pipeline=1` startup, four-tile detail, and right-side two-tile page
   transition durations.
2. Repeat with `pipeline=2`.
3. Confirm all four quadrants, binocular output, page ordering, detail
   entry/exit, map controls, hide/restore, and input responsiveness.
4. Confirm no `sendFailed`, timeout, missing quadrant, persistent tearing,
   deferred refresh, or WebView freeze.
5. Test `pipeline=3` only if every concurrency-two gate passes.
6. Select the fastest mode that completes the full gate without instability.

The experiment is successful only when wall-clock refresh duration is lower
than the same-session serial baseline and every stability gate passes.

## Rollback

The stable path requires no source rollback: omit `pipeline` or set
`pipeline=1`. If either pipelined mode fails on hardware, keep `main` serial,
record the evidence on the experiment branch, and do not merge the pipelined
default.

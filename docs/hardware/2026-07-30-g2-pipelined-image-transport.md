# G2 Pipelined Image Transport Hardware Gate

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-30

Status: Pipeline four partial physical pass

Branch: `experiment/g2-pipelined-transport`

SDK: `@evenrealities/even_hub_sdk` `0.0.11`

Design commit: `8915d1d`

Implementation-plan commit: `691fc29`

Pipeline resolver commit: `8f26dad`

Bounded runner commit: `772493a`

Application routing commit: `4b317c6`

Transport integration commit: `54a0e0f`

Four-call design commit: `ee30de1`

Four-call implementation-plan commit: `a981c79`

Four-call resolver commit: `288ad27`

Four-call transport coverage commit: `4414d7d`

## Purpose

Measure transition duration with two, three, or four G2 image updates in flight during one accepted refresh. Check display integrity and WebView stability for each limit.

This branch preserves the stable SDK, tile geometry, refresh busy gate, and 12-second tile timeout. It also preserves unchanged-tile skipping, success-only caching, and page rollback. Busy refresh requests remain dropped rather than deferred.

## Test URLs

Serial baseline:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&build=pipeline-baseline-036`

Pipeline two:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=2&build=pipeline-2-036`

Pipeline three:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=3&build=pipeline-3-037`

Pipeline four, owner-approved direct high-risk trial:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&build=pipeline-4-038`

Rollback URL:

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&build=pipeline-rollback-036`

## Transport contract

- One 576×288 Canvas is encoded as four 288×144 PNG tiles.
- Full-frame starts retain the order `3 → 5 → 2 → 4`.
- A limit of two starts tiles `3` and `5`, then fills the first available slot
  with tile `2`, followed by tile `4`.
- A limit of three starts tiles `3`, `5`, and `2`, then fills the first
  available slot with tile `4`.
- A limit of four starts tiles `3`, `5`, `2`, and `4` without waiting for an
  earlier SDK call to finish.
- Missing or invalid `pipeline` values resolve to the serial limit of one.
- Only SDK tile calls inside one accepted refresh overlap.
- Independent input, clock, battery, location, and content refreshes never
  queue, merge, retry, replay, or retain a pending latest value.
- The first observed tile failure prevents new tile starts.
- The runner waits for calls already in flight to settle before reporting refresh failure.
- Only successful tile payloads update the unchanged-tile cache.

## Expected diagnostics

Startup identifies the selected mode. For the four-call trial:

```text
[APP] transport start · pipeline 4
```

The full-frame tile starts identify their order and bounded in-flight count:

```text
[TILE] sandevistanTR start · 1/4 · inflight 1/4
[TILE] sandevistanBR start · 2/4 · inflight 2/4
[TILE] sandevistanTL start · 3/4 · inflight 3/4
[TILE] sandevistanBL start · 4/4 · inflight 4/4
```

Each success or failure retains its per-tile duration. Refresh completion
reports the encoding-plus-transfer wall-clock duration:

```text
[REFRESH] image refresh complete · sent 4 · skipped 0 · <duration>ms
```

A new request received while the accepted refresh is active must end
immediately:

```text
[REFRESH] <request> dropped · busy
```

It must not appear later as another accepted operation.

## Serial physical procedure

Use the same phone, Even app, glasses state, network, and HUD content. Run only
one test URL at a time.

1. Open the serial baseline URL.
2. Record startup, a four-tile detail transition, and a two-tile dashboard page
   transition.
3. Confirm all four quadrants, both eyes, page order, detail entry and exit,
   map controls, HUD hide and restore, and input responsiveness.
4. Close the serial run before opening the pipeline-two URL.
5. Repeat the same interactions and retain the complete diagnostics.
6. Confirm there is no `sendFailed`, timeout, missing quadrant, persistent
   tearing, deferred refresh, duplicate action, or WebView freeze.
7. Compare complete-refresh durations with the same-session serial baseline.
8. Close pipeline two before opening the owner-approved pipeline-four URL.
9. Repeat the same interactions and compare pipeline four directly with
   pipeline two.

## Pipeline-two physical checklist

- [ ] Startup completes with all four quadrants.
- [ ] Output appears in both eyes.
- [ ] Full-frame start order is `3 → 5 → 2 → 4`.
- [ ] The logged in-flight count never exceeds `2/2`.
- [ ] General page movement advances exactly one page per accepted input.
- [ ] Overview, News, TODO, Weather, and Navigation detail entry and return work.
- [ ] Map zoom direction and retained zoom state work.
- [ ] News body paging remains inside the article before the next article.
- [ ] TODO items can be checked and unchecked.
- [ ] HUD hide and restore work.
- [ ] Input remains responsive after the app is left open.
- [ ] Busy requests are dropped and never replayed later.
- [ ] No automatic retry occurs after a failed tile.
- [ ] No `sendFailed`, timeout, missing quadrant, persistent tearing, or freeze
  occurs.
- [ ] Complete-refresh duration is lower than the serial baseline.

## Pipeline-four physical checklist

- [ ] Startup completes with all four quadrants.
- [ ] Output appears in both eyes.
- [ ] Full-frame start order is `3 → 5 → 2 → 4`.
- [ ] The full-frame in-flight count reaches `4/4` and never exceeds it.
- [ ] No quadrant is missing or persistently torn.
- [ ] General page movement advances exactly one page per accepted input.
- [ ] Overview, News, TODO, Weather, and Navigation detail entry and return work.
- [ ] Map, news body, TODO, hide, and restore inputs remain responsive.
- [ ] Busy requests are dropped and never replayed later.
- [ ] No automatic retry occurs after a failed tile.
- [x] No `sendFailed` occurs.
- [ ] No timeout or WebView freeze occurs during an extended run.
- [ ] Complete-refresh duration is lower than pipeline two.

## Physical evidence

Owner: Repository owner, 2026-07-30

Device and Even app version:

Serial baseline log:

Pipeline-two log:

Pipeline-four log: Not supplied; owner confirmed no `SENDFAILED`.

Serial startup duration:

Pipeline-two startup duration:

Pipeline-four startup duration:

Serial four-tile detail duration:

Pipeline-two four-tile detail duration:

Pipeline-four four-tile detail duration:

Serial two-tile page duration:

Pipeline-two two-tile page duration:

Pipeline-four two-tile page duration:

Visual observations: Owner reports that pipeline four also appears acceptable.

Responsiveness observations:

Preliminary observation: the owner reports that pipeline two feels somewhat
better than serial. Exact comparable logs are not yet recorded.

Pipeline-four immediate observation: no `SENDFAILED` occurred. Exact
pipeline-two versus pipeline-four timing and extended idle stability are not
yet recorded.

Result: `PARTIAL PASS — DISPLAY ACCEPTABLE, NO SENDFAILED`

## Decision rule

Pipeline two must be faster than the same-session serial baseline. It must also pass every visual, binocular, control, failure, and responsiveness check. Pipeline four must pass the same checks and be faster than pipeline two.

If pipeline four fails, return to `pipeline=2` or `pipeline=1`, keep `main`
serial, record the failure on this branch, and do not promote the failed mode.

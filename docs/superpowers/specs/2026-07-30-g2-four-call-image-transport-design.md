# G2 Four-Call Image Transport Experiment Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-30

Status: Implemented; partial physical pass

Branch: `experiment/g2-pipelined-transport`

## Goal

Compare four concurrent full-frame G2 image updates with the owner-observed `pipeline=2` mode.
Measure speed while checking complete output, both eyes, responsiveness, and stability.

The experiment remains opt-in. It does not change the serial default, the
stable `main` branch, or the pinned Even Hub SDK `0.0.11`.

## Selected approach

Extend the existing literal pipeline setting from `1 | 2 | 3` to
`1 | 2 | 3 | 4`.

`pipeline=4` passes a concurrency limit of four to the existing bounded task
runner. For a full-frame refresh, SDK calls start in the established order
`3 → 5 → 2 → 4` without waiting for an earlier tile to finish. Completion
order may differ.

The setting is a maximum, not a fixed batch size:

- a four-tile refresh may have four SDK calls in flight;
- a two-tile dashboard or map refresh may have two calls in flight;
- a one-tile clock or battery refresh has one call in flight.

Missing, malformed, zero, negative, or larger values continue to resolve to
the serial limit of one.

## Preserved transport contract

- One accepted refresh owns the transport at a time.
- Independent refresh requests received while busy are dropped immediately.
- No request is queued, merged, replayed, retried, or retained as a pending
  latest value.
- PNG encoding completes before SDK tile calls start.
- Unchanged successful tile payloads are skipped before consuming an SDK
  in-flight slot.
- Each SDK tile call retains its 12-second timeout.
- Only a successful tile updates its payload cache entry.
- The first observed failure prevents any not-yet-started tile from starting.
- Calls already in flight settle before the accepted refresh rejects.
- Existing logical page rollback remains unchanged.

At concurrency four, all four calls normally start before an asynchronous failure is observable.
Failure handling still applies to smaller target sets, synchronous exceptions, and future target sizes.
It does not cancel calls already sent to the SDK.

## Alternatives

### Promote pipeline two

The owner reports that pipeline two feels better.
Do not make it the default until comparable logs and a stability record support the change.

### Test pipeline three first

Pipeline three is lower risk, but the owner explicitly requested a four-call
trial after understanding the higher-risk behavior. Pipeline three remains
available for comparison but is not a prerequisite for this opt-in test.

### Add a second refresh scheduler

Rejected. Only tile calls inside one accepted refresh may overlap. A refresh
pipeline would reintroduce the backlog and WebView-freeze failure mode already
removed from the project.

## Diagnostics

Startup reports:

```text
[APP] transport start · pipeline 4
```

A full-frame refresh must report four ordered starts with a bounded in-flight
count ending at `4/4`:

```text
[TILE] sandevistanTR start · 1/4 · inflight 1/4
[TILE] sandevistanBR start · 2/4 · inflight 2/4
[TILE] sandevistanTL start · 3/4 · inflight 3/4
[TILE] sandevistanBL start · 4/4 · inflight 4/4
```

The existing complete-refresh duration remains the primary latency measure.

## Automated verification

All checks run serially.

- The resolver accepts `pipeline=4` and still rejects `0`, `5`, and malformed
  values to one.
- The phone application passes the literal value four to the fast transport.
- The bounded runner permits a maximum of four.
- A full-frame refresh starts IDs `[3, 5, 2, 4]` before any held call settles.
- The maximum observed SDK image-call count is four.
- Two-tile and one-tile target behavior remains bounded by actual target size.
- Existing concurrency-one, two, and three tests remain green.
- Existing failure, timeout, cache, busy-drop, page rollback, build, package,
  repository, and SDK-version gates remain green.

## Physical G2 gate

Use build marker `pipeline-4-038` on the existing isolated port `4177`.

Compare `pipeline=2` and `pipeline=4` using the same phone, Even app, glasses
state, HUD content, and interaction sequence. Record startup, four-tile detail,
and two-tile page durations.

Pipeline four passes only when:

- all four quadrants appear in both eyes;
- there is no missing or persistently torn tile;
- no `sendFailed` or timeout occurs;
- page, detail, map, hide, restore, and subsequent inputs remain responsive;
- busy inputs are dropped rather than replayed;
- the WebView remains responsive while idle;
- its complete-refresh duration is lower than pipeline two.

If any item fails, return immediately to `pipeline=2` or `pipeline=1`. Do not
promote four as a default.

## Rollback

No source rollback is needed. Remove the query, use `pipeline=1`, or return to
the already tested `pipeline=2` URL. The experiment branch remains isolated
from `main` until physical evidence supports a separate promotion decision.

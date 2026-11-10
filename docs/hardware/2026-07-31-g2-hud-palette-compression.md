# G2 HUD Palette Compression Hardware Gate

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-31

Status: Partial physical pass; hide-path refinement required

Branch: `experiment/g2-pipelined-transport`

## Goal

Measure G2 image-refresh latency after mapping transmitted Canvas pixels to the four authored HUD gray levels. Verify legibility, binocular completeness, and WebView stability.

## Baseline

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&build=pipeline-4-038
```

This route keeps the accepted four-call image pipeline and sends the original
temporary-tile PNG pixels.

## Candidate

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&levels=4&build=palette-4-039
```

This route keeps the same transport but maps only the transmitted tile pixels
to `0`, `128`, `208`, and `255` before PNG encoding. It does not modify the
source HUD Canvas or phone preview.

## Serial comparison sequence

Do not run the baseline and candidate simultaneously.

For each route:

1. Allow one warm-up refresh.
2. Enter and leave a four-tile detail page five times.
3. Move across a two-tile dashboard page five times.
4. Hide and restore the display five times.
5. Leave the WebView idle, then confirm the next input remains responsive.

Use the same phone, Even app, glasses state, HUD data, and interaction cadence.

## Required evidence

For each route, record:

- the `ENCODE` total PNG byte count and per-tile byte counts;
- complete-refresh durations for four-tile and two-tile updates;
- all four quadrants and both-eye completeness;
- clock, weather, news body, TODO, and map-label legibility;
- any persistent tearing, missing tile, timeout, or `sendFailed`;
- whether inputs received while busy are dropped instead of replayed;
- idle and post-idle WebView responsiveness.

The candidate passes only if it reduces total encoded bytes, improves the
median four-tile complete-refresh duration, and preserves every visual and
stability requirement.

## Physical result

The owner compared the baseline and candidate serially on 2026-07-31 and
provided the raw WebView trace.

### Content restore

| Metric | Baseline | Four-level candidate | Change |
| --- | ---: | ---: | ---: |
| Full HUD PNG bytes | 50,031 | 22,821 median | 54.4% lower |
| Encode duration | 22.5 ms median, n=4 | 96 ms median, n=8 | 73.5 ms higher |
| Complete refresh | 2,468 ms median, n=4 | 1,855 ms median, n=8 | 613 ms / 24.8% faster |

The reduced payload outweighed the additional pixel-processing cost. The
four-level candidate therefore passes the measured full-content restore
performance gate.

### Black-frame hide

| Metric | Baseline | Four-level candidate | Change |
| --- | ---: | ---: | ---: |
| Black PNG bytes | 4,704 | 4,704 | unchanged |
| Complete refresh | 338 ms median, n=5 | 393 ms median, n=8 | 55 ms / 16.3% slower |

The hidden frame was already solid black. Palette processing could not reduce its PNG payload and added CPU work. A follow-up candidate
should bypass palette conversion for the generated black hidden Canvas while
retaining four-level conversion for content restores.

### Stability and visual report

- No `sendFailed` or tile timeout appears in either supplied trace.
- All shown full-frame calls started with four in-flight SDK calls.
- Busy external refreshes were dropped rather than replayed.
- The owner reported that the candidate may feel somewhat faster, without a
  clear visual regression in this comparison.
- This trace does not independently prove the full binocular, page-transition,
  long-idle, or every-label legibility gate.

## Decision

Retain the four-level content candidate. Before promoting this revision, remove redundant hide-frame quantization. Then repeat the hide and restore comparison. Complete the remaining visual and stability checks.

## Automated gate

- Vitest: 57 files, 508 tests passed serially.
- TypeScript: passed.
- Repository copy checks: 5 passed serially.
- Production and Sites build: passed.
- Sites worker tests: 4 passed serially.
- Even Hub package: `sandevistan.ehpk`, SDK `0.0.11`.

## Rollback

Remove `levels=4` or return to the baseline URL. No source rollback is needed.

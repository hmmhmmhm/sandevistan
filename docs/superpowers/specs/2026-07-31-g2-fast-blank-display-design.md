# G2 Fast Blank Display Experiment Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-31

Status: Approved for planning; implementation not started

## Goal

Compare a blank event-capture page rebuild with sending four black image tiles.
Measure whether the rebuild hides the Sandevistan HUD faster.
Keep the WebView session and double-tap input active.

This is an isolated hardware experiment. The query-free production route keeps
the proven four-black-tile display toggle until the candidate passes its
physical gate.

## Current Baseline

The accepted display toggle keeps the startup page alive and sends four minimal
black PNG tiles. Recent physical traces measured approximately 330–450 ms for
the complete hide operation. Restore redraws the latest HUD and sends four
content tiles, typically taking about 1.8–2.1 seconds.

SDK `0.0.13` has no display-sleep, container-visibility, or z-order update API.
`shutDownPageContainer(0)` closes the glasses page.
It cannot guarantee that the hidden page still receives the double tap required to restore it.
Instead, use the supported `rebuildPageContainer` lifecycle operation for this candidate.

## Routes and Isolation

```text
Control:   /hud-canvas-fast?sdk=0.0.13&build=<BUILD-ID>
Candidate: /hud-canvas-fast?sdk=0.0.13&hide=blank&build=<BUILD-ID>
```

Only the literal `hide=blank` query enables the candidate. Missing, invalid, or
differently cased values keep the current black-tile strategy. The candidate
does not alter image format, palette, pipeline concurrency, navigation, live
data, or input classification.

## Blank Page Shape

The blank page contains exactly one full-display text container:

- position: `0, 0`;
- size: `576 × 288`;
- border width and padding: `0`;
- content: one blank space;
- container ID: `1`;
- container name: `eventLayer`;
- event capture: enabled;
- image and list containers: none;
- total container count: `1`.

The empty text surface is expected to illuminate no pixels while continuing to
capture G2 and R1 input. It must not use native text for visible HUD content.

## Hide Flow

When the display is visible and an accepted double tap arrives:

1. Acquire the existing single-operation transport ownership.
2. Log `hide start · strategy blank-rebuild`.
3. Call `rebuildPageContainer` with the blank page.
4. Treat `false` or a thrown error as a failed hide.
5. Mark the display hidden only after a successful rebuild.
6. Log the complete hide duration and return without encoding or sending an
   image.

No fallback black-tile transmission is attempted during the same event. This
preserves the project's fail-fast, no-retry, no-queue policy and keeps the
candidate measurement honest.

## Restore Flow

When the display is hidden and an accepted double tap arrives:

1. Acquire the existing single-operation transport ownership.
2. Redraw the newest live HUD state into the existing Canvas.
3. Rebuild the normal page containing the four image containers and one event
   layer, using the established IDs, geometry, and order.
4. If rebuilding succeeds, send all four current content tiles through the
   existing PNG, four-level palette, pipeline-four path.
5. Mark the display visible only after all four image updates succeed.

If normal-page rebuild or image transfer fails, the state remains hidden. The
next independent double tap may make a new restore attempt. No failed work is
retained or replayed.

## Input and Concurrency Rules

- Only one accepted refresh or display transition may own the transport.
- Input arriving while the candidate is rebuilding or restoring is dropped.
- While hidden, tap and scroll events are ignored; double tap remains active.
- Live time, weather, news, battery, and location updates may update WebView
  state but may not trigger glasses image transfer while hidden.
- No operation queue, merge, deferred replay, retry, or automatic fallback is
  introduced.

## Diagnostics

The experiment extends existing `REFRESH` diagnostics without adding an
unbounded logger or a new polling loop:

```text
[REFRESH] hide start · strategy blank-rebuild
[REFRESH] blank rebuild success · <duration>ms
[REFRESH] hide complete · <duration>ms
[REFRESH] restore page rebuild success · <duration>ms
[REFRESH] restore complete · <duration>ms
```

Failures remain `ERROR` entries and include the failed operation and duration.
The control route keeps its current diagnostics unchanged.

## Automated Verification

Tests must prove:

1. the strategy resolver defaults to black tiles and enables only literal
   `hide=blank`;
2. the blank page has exactly one correctly configured event-capture container;
3. candidate hide performs one rebuild and zero image encodes or updates;
4. candidate restore rebuilds the normal page before four image updates;
5. hidden state changes only after the corresponding operation succeeds;
6. hide and restore failures are not retried, queued, or silently converted to
   the control strategy;
7. busy input is dropped and hidden non-double-tap input remains ignored;
8. the query-free control retains the four-black-tile behavior;
9. all existing serial tests, type checks, builds, repository checks, and Sites
   checks remain green.

## Serial Physical Gate

Run control and candidate separately. Do not keep both routes open.

For each route:

1. confirm complete binocular HUD output;
2. perform at least ten hide and restore cycles;
3. record input-to-hide completion and input-to-restore completion durations;
4. confirm that the hidden display emits no visible pixels;
5. confirm that double tap restores the current page without an app-close
   prompt;
6. confirm scroll and tap remain usable after the final restore;
7. leave the WebView idle for at least five minutes, then repeat two cycles;
8. record any rebuild failure, `sendFailed`, missing tile, stale restore,
   WebView freeze, unexpected input replay, or visible flash.

The candidate passes only if:

- median hide duration is at least 25% lower than the control median;
- all hidden states are visually blank;
- all restores return to complete binocular output;
- there are no rebuild failures, image errors, close prompts, freezes, or
  deferred input replays.

If the candidate fails any condition, remove its runtime path and retain this
document as a rejected hardware record.

## Out of Scope

- pre-rendering previous and next page images;
- keeping multiple page images resident in glasses containers;
- z-order page-bank switching;
- modifying or forking the native Even App;
- native text over Canvas content;
- changing the accepted PNG, palette, or pipeline defaults;
- replacing the production display toggle before physical approval.

# G2 Fast Blank Display Hardware Gate

> Historical G2 record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-31

Status: Promoted by owner decision

Branch: `experiment/g2-fast-blank-display`

## Goal

Compare hide duration for one blank full-screen event container against four black image tiles. Verify double-tap recovery, binocular output, and long-running WebView responsiveness.

This candidate is not an official sleep mode. The Even Hub app, event listener,
live-data session, and phone companion remain active.

## Control

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&hide=black&build=hide-black-control-048
```

The explicit diagnostic control encodes and sends four minimal black PNG tiles
when hiding. A second double tap sends the latest four HUD tiles.

## Candidate

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&build=hide-blank-default-048
```

The production default rebuilds the page as one 576×288 blank event-capture text
container. It performs no image encoding or image transfer while hiding. A
second double tap redraws the latest HUD, rebuilds the normal five-container
page, clears the successful-tile cache, and sends all four current tiles.

## Transport invariants

- Only the exact `hide=black` query selects the diagnostic control.
- Missing, `hide=blank`, differently cased, or invalid `hide` values use the
  blank rebuild.
- One accepted input owns the transport; input received while busy is dropped.
- There is no deferred queue, merge, replay, automatic retry, or same-event
  fallback.
- A failed blank rebuild leaves the HUD logically visible.
- A failed restore rebuild leaves the HUD logically hidden.
- Every fresh double tap after a failure may start one new independent attempt.
- A successful restore rebuild forces all four tiles to be sent, even when
  their bytes match the last visible frame.

## Serial comparison procedure

Complete the control run first. Close its WebView before opening the candidate.

For each route:

1. Confirm startup shows all four quadrants in both eyes.
2. Perform one warm-up hide and restore cycle.
3. Perform ten measured hide and restore cycles.
4. Wait for each `input double-tap complete` record before the next gesture.
5. Record hide duration from `input double-tap accepted` through `complete`.
6. Record restore duration over the same boundary.
7. Confirm every hide produces a visually blank display in both eyes.
8. Confirm every restore returns all four current quadrants in both eyes.
9. Scroll through every dashboard page after the tenth restore.
10. Leave the WebView idle for at least five minutes, then repeat one hide,
    restore, and page scroll.

Use the same phone, Even app, G2 firmware, glasses charge state, location, HUD
content, and interaction cadence for both routes. Do not run unrelated G2
transfers during either measurement.

## Required diagnostics

The control hide should contain one four-tile encode and four tile sends. The
candidate hide should instead contain:

```text
[REFRESH] hide start · strategy blank-rebuild
[REFRESH] blank rebuild success
[REFRESH] hide complete
```

There must be no `ENCODE` or `TILE` entry between the candidate hide start and
hide completion. Candidate restore must contain `restore page rebuild success`,
one four-tile encode, and four successful tile sends.

Record any `sendFailed`, timeout, false rebuild, missing tile, one-eye-only
frame, persistent tearing, ignored post-idle input, close prompt, or WebView
freeze.

## Original promotion gate

The original experiment defined all of the following conditions:

- candidate median hide duration is at least 25% lower than the control median;
- all ten measured candidate hides are visually blank in both eyes;
- all ten measured candidate restores show all four current tiles in both eyes;
- there are zero rebuild failures, image-send failures, timeouts, freezes, or
  unexpected close prompts;
- page scrolling and the post-idle hide/restore remain responsive; and
- logs prove the candidate hide performed no image encode or image send.

The owner later accepted the measured physical result and explicitly waived
the remaining sampling and idle checks. The incomplete rows below remain
unchanged so the historical evidence is not overstated.

## Result table

| Metric | Black-tile control | Blank-rebuild candidate |
| --- | ---: | ---: |
| Measured hide / restore | 5 / 5 prior control operations | 8 / 7 candidate operations |
| Median hide | 394 ms | 87.5 ms |
| Median restore | 2,105 ms | 2,044 ms |
| Hide image encodes | 1 per hide | 0 per hide |
| Hide image sends | 4 per hide | 0 per hide |
| Rebuild failures | Not applicable | 0 observed |
| `sendFailed` / timeout | 0 observed | 0 observed |
| Binocular blank hides | Prior control accepted | Immediate disappearance reported; count pending |
| Complete four-tile restores | 5/5 transport operations | 7/7 transport operations |
| Five-minute idle recovery | Awaiting | Awaiting |

## Physical result

The owner ran the candidate on updated G2 hardware and Even App with SDK `0.0.13`. The owner reported extremely fast disappearance and supplied the complete WebView trace excerpt on 2026-07-31.

Eight candidate hide operations completed in `94`, `93`, `86`, `63`, `65`,
`64`, `94`, and `89` ms. The median was 87.5 ms, with a 63–94 ms range. The
blank page rebuild itself had an 87 ms median. Every hide trace contained the
required blank-rebuild records and no `ENCODE` or `TILE` operation between hide
start and completion.

The most recent same-SDK black-tile control trace contained five comparable
hide operations with a 394 ms median. The candidate reduced median hide latency by 77.8%. It passed the required 25% performance gate.

Seven candidate restores completed in `1,962`, `1,979`, `2,005`, `2,131`,
`2,044`, `2,135`, and `2,103` ms. The median was 2,044 ms. The restore-page rebuild had an 84 ms median. The four-tile encode had a 91 ms median. The four-tile image refresh had a 1,952 ms median. Every recorded restore rebuilt
the normal page, encoded once, started all four tile calls, received four
success results, and committed the display.

No rebuild failure, `sendFailed`, timeout, retry, queued replay, WebView freeze,
or unexpected close prompt appears in the supplied trace. A tap received while
hidden was ignored as designed, and input received during an active image
refresh was dropped rather than replayed.

## Decision

The hide-performance and sampled transport-reliability criteria pass. On 2026-07-31, the owner reported extremely fast disappearance and accepted the result. The owner declined further testing of this behavior and directed promotion of blank rebuild to the query-free production default. The uncompleted items in the
original gate are therefore recorded as waived rather than silently marked as
passed. The former black-tile behavior remains available only through exact
`hide=black` for diagnosis and rollback.

## Automated evidence

The implementation gate covers strict query resolution, blank and normal page shape, and option propagation. It checks zero-image hiding, forced four-tile restoration, failed-hide visibility, failed-restore hidden state, and fresh-event recovery. It also checks query-free blank behavior, explicit black-control behavior, sequential test execution, and the 450-line transport module boundary.

## Rollback

Use `hide=black` or `npm run qr:hide-black`. No source rollback is required.
Remove the query again to return to the production blank-rebuild behavior.

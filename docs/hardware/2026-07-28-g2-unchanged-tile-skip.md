# G2 Unchanged-Tile Transport Skip Experiment

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-28

SDK: `0.0.11`

Build: `dirty-tiles-032`

Result: `PASS (NO REGRESSION)`

Branch: `feature/g2-ors-routing`

Remote baseline commit: `90a9421`

Local implementation commit: `514e486`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=dirty-tiles-032`

## Purpose

Keep the SDK and serial PNG transport path already validated on physical G2 hardware. If a tile's PNG bytes match its last successful payload exactly, skip `updateImageRawData`.

## Transport rules

- Encode the 576×288 Canvas as four 288×144 PNG images.
- Preserve the initial full-frame order `3 → 5 → 2 → 4`.
- Preserve right-side page updates in the order `3 → 5`.
- After encoding a refresh, compare each tile by byte length and every byte.
- Finish an unchanged tile as `skipped` without making an SDK call.
- Replace a tile's cache only after a successful SDK call.
- Do not replace the cache after failure, exception, or timeout.
- If an earlier tile succeeds and a later tile fails, retain the earlier tile's
  successful state.
- Do not add a transport-request queue, merging, or automatic retries.
- Drop a new request during transport immediately as `dropped · busy`.
- Hidden black frames and HUD restore frames have different pixels and therefore
  send all four tiles.

## Automated verification

- RED confirmed: three tests for identical data, a partial change, and a partial
  failure all failed before implementation.
- Focused transport suite: 56 tests passed.
- `npm test`: 37 files and 374 tests passed.
- `npm run test:sites`: 4 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: 67 modules transformed; production build passed.

All test and build commands ran sequentially in one process.

## Physical G2 checklist

- [x] Initial transport sends four tiles in the order `3 → 5 → 2 → 4`.
- [ ] A target tile in an unchanged refresh logs `skipped · unchanged`.
  This interaction did not re-render an identical tile, so it was not observed
  in the hardware log.
- [ ] An unchanged refresh produces no new `[TILE] ... start`.
  This was not observed in the hardware log for the same reason.
- [ ] A refresh that changes one tile logs `sent 1 · skipped 1`.
  No physical interaction produced this partial change, so it was confirmed
  only by automated tests.
- [x] Page movement, detail entry, and detail exit each happen once and promptly.
- [ ] After a partial transport failure, the next independent event retries
  only the failed tile. The automated test covers this case; the physical test
  did not induce a failure.
- [x] A refresh received during transport ends as `dropped · busy` and does not
  run later.
- [x] Existing controls, including HUD hide and restore, work normally.
- [x] Neither `SENDFAILED` nor a WebView freeze occurred.

## Physical G2 result

The user confirmed that scrolling felt faster and every control worked
normally. In the supplied log, the initial four-tile transport took 481ms and
right-side two-tile page transitions took 751–999ms. There was no `SENDFAILED`,
queue buildup, or WebView freeze. A minute refresh also ended as
`minute refresh skipped · already rendered` when another render had already
shown the current minute.

Every physical render in this log reported `sent 2 or 4 · skipped 0`, which is
expected because each page and detail view had different content. The observed speed improvement therefore does not establish a benefit from unchanged-tile skipping. Automated tests lock down identical-frame skipping, one-tile changes,
and a new request after partial failure. The physical G2 acceptance criterion
was no regression in existing behavior.

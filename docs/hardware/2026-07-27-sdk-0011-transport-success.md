# SDK 0.0.11 G2 Transport Success

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-27
SDK: `0.0.11`
Build: `fast-right-first-011`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fast-right-first-011`
Path: `/hud-canvas-fast?sdk=0.0.11&build=fast-right-first-011`
Result: PASS

## As-run test stages

The final PASS applies to the combined SDK and send-order build. It does not isolate the SDK change. The preceding `fast-live-011` stage isolated SDK `0.0.11` and
established bilateral display, row-major `2/3/4/5` full rendering, normal
scrolling, and no `SENDFAILED`. The user then requested right-column-first
loading. Commit
`df19655a40dc72a088fb702c8d3e1cade7e0274d` produced
`fast-right-first-011`, combining SDK `0.0.11` with the fast-only `3/5/2/4`
full-send order used for final approval.

## Physical G2 checklist

- Bilateral display: PASS
- All four quadrants of the `576 x 288` frame render: PASS
- Bottom scroll advances exactly one page in the existing 1→2→3→4 direction
  with the fast right-two-tile transition: PASS
- Right-two-tile paging retained the previously approved build-008-class
  immediate transition: PASS
- Top scroll moves exactly one page backward: PASS
- Full transfer visibly loads right-top, right-bottom, left-top, left-bottom
  (`3/5/2/4`): PASS
- Double-tap black hide and restore: PASS
- `SENDFAILED`: not observed

## Automated evidence

The gate build at commit `df19655a40dc72a088fb702c8d3e1cade7e0274d`
also passed:

- source tests: 53/53;
- TypeScript typecheck;
- production build;
- Sites tests: 4/4.

## Approved transport contracts

- Fast full transfer: `3/5/2/4`
- Fast scroll transfer: `3/5`
- Legacy full transfer: `2/3/4/5`

At this checkpoint, SDK `0.0.11` was the live-data baseline. SDK `0.0.12` required a separate physical G2 pass before adoption.

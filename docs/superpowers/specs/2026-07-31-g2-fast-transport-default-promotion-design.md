# G2 Fast Transport Default Promotion Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-31

Status: Implemented; physical gate passed and integrated into `main`

Branch: `experiment/g2-pipelined-transport`

Target base: `main`

## Goal

Promote the physically measured fast G2 transport combination to the
`/hud-canvas-fast` default:

- four in-flight SDK image calls per accepted refresh;
- four-level transmitted-tile palette compression;
- no redundant palette pass for the generated solid-black hidden frame.

The promotion must preserve explicit rollback controls, SDK `0.0.11`, the
no-queue refresh contract, the proven tile geometry and order, and the
existing phone preview.

## Evidence

### Four-call transport

The physical G2 displayed the four-call pipeline without `sendFailed`. The
owner accepted its responsiveness and supplied no missing-tile or binocular
regression report.

### Four-level palette

The serial physical comparison recorded:

| Metric | Original PNG | Four-level PNG | Change |
| --- | ---: | ---: | ---: |
| Full HUD payload | 50,031 bytes | 22,821 bytes | 54.4% lower |
| Full restore median | 2,468 ms, n=4 | 1,855 ms, n=8 | 24.8% faster |
| Encode median | 22.5 ms | 96 ms | 73.5 ms higher |

The payload reduction outweighed the additional pixel-processing cost.

### Hidden frame

Both modes encoded the solid-black hidden frame to 4,704 bytes. Palette
processing could not reduce that payload, and the candidate hide median
regressed from 338 ms to 393 ms. The hidden frame must therefore use the
original encoder path while content frames retain the four-level mode.

## Selected approach

### Default resolver behavior

`resolveImageSendConcurrency` resolves:

- a missing `pipeline` query to `4`;
- literal `1`, `2`, `3`, and `4` to the corresponding value;
- malformed, zero, negative, and unsupported values to the new default `4`.

`resolveG2TilePaletteMode` resolves:

- a missing `levels` query to `"hud-4"`;
- literal `levels=4` to `"hud-4"`;
- literal `levels=original` to `"original"`;
- malformed and unsupported values to the new default `"hud-4"`.

The complete explicit rollback URL is:

```text
?pipeline=1&levels=original
```

The default route requires no performance query:

```text
/hud-canvas-fast
```

### Hidden-frame palette override

`refreshImages` accepts a per-call palette override that defaults to the
transport's resolved content palette.

The hide path passes `"original"` for its generated black Canvas. Initial
content, restore, navigation, input redraw, clock, battery, location, weather,
news, TODO, and map updates continue to use the resolved content palette.

The override changes only temporary-tile encoding. It does not change:

- the hidden Canvas pixels;
- image container IDs or names;
- target tile order;
- the payload cache;
- SDK call concurrency;
- failure or busy-drop behavior;
- visible or logical display state.

Diagnostics report `palette original` for hides and `palette hud-4` for default
content refreshes, making the bypass directly observable.

### Hardware and rollback URLs

The package scripts expose:

- one query-free default URL with a new build marker;
- one explicit serial/original rollback URL;
- the existing historical pipeline and palette experiment URLs.

Historical URLs and physical evidence remain unchanged for reproducibility.

## Preserved transport contract

- One accepted refresh owns the transport.
- Independent refresh requests received while busy are dropped immediately.
- No request is queued, merged, replayed, retried, or stored as pending work.
- Full-frame start order remains `3 → 5 → 2 → 4`.
- Right-side page updates remain IDs `3 → 5`.
- Left-side map updates remain IDs `2 → 4`.
- Each SDK call retains its existing timeout.
- Only successful bytes update the per-tile payload cache.
- Already in-flight calls settle after a failure; no later retry is created.
- SDK remains pinned to `0.0.11`.
- Phone WebView preview and the source 576×288 Canvas remain unquantized.

## Alternatives

### Promote defaults without a hidden-frame override

Rejected because the supplied physical trace shows a measurable 16.3% hide
regression with no payload benefit.

### Promote only the palette

Rejected by the owner in favor of promoting both the accepted four-call
pipeline and four-level palette.

### Add indexed PNG encoding during promotion

Rejected for this revision. Indexed PNG changes the PNG encoder and physical
decoder compatibility surface. It remains the highest-priority isolated
follow-up experiment, not part of a proven-default promotion.

## Automated verification

All checks run serially.

- Missing and invalid pipeline queries resolve to four.
- Explicit pipeline values one through four remain available.
- Missing and invalid palette queries resolve to four-level.
- `levels=original` remains an explicit rollback.
- The App passes default four-call and four-level options to the fast
  transport.
- The default content encode receives `"hud-4"`.
- A hide encode receives `"original"` even when content uses `"hud-4"`.
- Restore and later content refreshes return to `"hud-4"`.
- Hidden bytes, tile order, cache updates, busy drops, and input state remain
  unchanged.
- Default and rollback QR scripts contain the exact SDK, query, host, and build
  markers.
- Source, type, repository, build, Sites, package, module-boundary, SDK, and
  no-Korean-copy gates remain green.

## Physical verification

Use the query-free default build and repeat at least five hide/restore cycles.

The promotion passes when:

- content restore retains the four-level payload and performance class;
- hide logs `palette original`;
- hide returns to the original performance class without changing its 4,704
  byte payload;
- all four quadrants and both eyes remain complete;
- no `sendFailed`, timeout, persistent tear, missing tile, or input freeze
  occurs;
- busy inputs remain dropped rather than replayed.

## Integration

After automated verification and a clean working tree:

1. push the promotion branch;
2. keep its worktree available for the physical check;
3. fast-forward `main` only after the default route passes the physical
   hide/restore gate;
4. rerun the full serial test suite on the integrated `main`;
5. push `main` without deleting the historical experiment branch.

This sequence makes the selected behavior the repository default while
retaining every rollback and evidence path.

## Follow-up experiment

After physical acceptance of this promotion, test a true two-bit indexed PNG encoder for the four-color HUD payload.
Use a separate query and hardware test.
Retain the current Canvas PNG for rollback.

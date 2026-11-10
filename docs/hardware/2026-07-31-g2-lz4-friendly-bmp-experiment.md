# G2 LZ4-Friendly BMP Hardware Gate

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-31

Status: Reliable physical pass; speed gate failed

## Goal

Compare four-level Canvas PNG with an opt-in uncompressed 1-bit BMP on the SDK `0.0.13` image path. The BMP candidate aims to improve compression in the Even App LZ4 transport.

## Controlled routes

```text
PNG:  /hud-canvas-fast?sdk=0.0.13&pipeline=4&format=png
BMP:  /hud-canvas-fast?sdk=0.0.13&pipeline=4&format=bmp1
```

Both routes used the same 576×288 source frame, four 288×144 containers,
four-call transport, unchanged-tile skip policy, and no-queue busy-drop
behavior. The solid-black hidden frame remained PNG in both routes.

## Physical result

### Full four-tile content

| Metric | 1-bit BMP | Four-level PNG | BMP change |
| --- | ---: | ---: | ---: |
| Complete refresh median | 1,886 ms, n=8 | 1,645 ms, n=7 | 241 ms / 14.7% slower |
| Representative total bytes | 20,984 | 21,968 | 984 bytes / 4.5% lower |
| Encode duration | about 99–110 ms | about 86–95 ms | slightly slower |

### Hide and restore

| Metric | 1-bit BMP route | PNG route | Result |
| --- | ---: | ---: | --- |
| Restore median | 1,886 ms, n=6 | 1,701 ms, n=5 | BMP 185 ms / 10.9% slower |
| Hide median | 363.5 ms, n=6 | 376 ms, n=6 | equivalent noise range |

The hide comparison does not measure BMP because both routes deliberately use
the same minimal black PNG frame.

## Transport observation

All four SDK calls entered the in-flight state within a few milliseconds, but
their completion times remained progressively staggered. This pattern suggests a shared downstream transfer path in the Even App, BLE stack, or glasses. It does not establish four independent physical channels. The public Web SDK does not expose post-LZ4 byte counts, packet scheduling, or acknowledgment timing. Use end-to-end hardware duration to compare the routes.

The control skipped unchanged PNG tiles in parts of the two-tile run. Those traces are therefore not a controlled A/B sample. The controlled four-tile
result is already sufficient to reject BMP as the speed default.

## Stability

- No `sendFailed` or image timeout appeared.
- No WebView freeze appeared.
- Inputs received while an image refresh was busy were dropped immediately.
- No dropped input or external refresh was queued, merged, or replayed later.
- Both content formats reached all requested containers in the supplied logs.

## Decision

Keep four-level PNG as the query-free production default. Retain
`format=bmp1` only as an explicit hardware diagnostic and regression path.
The BMP route passed compatibility and stability but failed the speed gate.

Do not treat the next optimization as a return to native SDK text over a
Canvas background. That hybrid was previously rejected because native text
could not match the required font size, shape, grayscale, wrapping, or exact
position. A future experiment should first target the WebView-to-native image
bridge or a new native batch-image API while keeping accepted Canvas text.

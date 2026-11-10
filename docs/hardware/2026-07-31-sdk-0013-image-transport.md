# SDK 0.0.13 G2 Image Transport Gate

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

## Status

- Date: 2026-07-31
- Branch: `experiment/g2-sdk-0013`
- Base commit: `09d750bf81314c352cf4e0c2414b9483e304688a`
- Candidate SDK: `@evenrealities/even_hub_sdk` `0.0.13`
- Minimum Even App: `2.2.6`
- Updated G2 firmware: confirmed by the owner
- Automated candidate verification: passed
- Physical candidate verification: passed
- Promotion decision: approved for `main`

## Background

SDK `0.0.12` introduced internal LZ4 compression for image raw-data updates.
On the previously tested Even App and G2 firmware, the first image tile returned
`sendFailed` in approximately 7 ms and no image appeared. The isolated failure
remains preserved on the `0.0.12-reproduce` branch.

At this checkpoint, Even Realities reported a repair for the compressed-image problem. The owner installed the updated Even App and glasses firmware. The npm registry identified SDK `0.0.13` as latest. Its package metadata required Even App `2.2.6` or later.

## Isolated Change

The candidate changes only:

- SDK dependency `0.0.11` to `0.0.13`;
- `app.json.min_sdk_version` to `0.0.13`;
- `app.json.min_app_version` to `2.2.6`;
- the candidate QR port, SDK marker, and build marker before promotion.

The SDK adds `compressMode: 2` internally when serializing
`ImageRawDataUpdate`. Sandevistan does not add or modify this field itself.

## Preserved Transport Contract

- 576 x 288 Canvas frame split into four 288 x 144 PNG tiles
- Existing Canvas PNG encoder with transmitted `hud-4` levels
- Four in-flight SDK image calls
- Full-frame order `3/5/2/4`
- Right-page order `3/5`
- Byte-level unchanged-tile skipping
- Immediate busy and hidden drops
- No refresh queue, replay, retry, or catch-up processing
- Canvas/original solid-black hide path

## Gate-Time Serial URLs

These URLs record the isolated comparison used during the physical gate. Only
one Mini App URL was opened at a time.

### SDK 0.0.13 candidate

```text
http://100.127.255.11:4179/hud-canvas-fast?sdk=0.0.13&build=sdk-0013-repair-042
```

### SDK 0.0.11 rollback reference

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040
```

### Serial and original-palette rollback

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&levels=original&build=rollback-serial-original-040
```

After promotion, the main URL is:

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&build=sdk-0013-main-043
```

## Automated Contract Record

- Focused pre-change test failed for the expected SDK, app version,
  compression flag, and phone metadata mismatches.
- Focused post-change test: 2 files and 4 tests passed.
- `ImageRawDataUpdate.toJson()` returns the original container fields and
  bytes plus `compressMode: 2` under SDK `0.0.13`.
- Fake-host bridge integration verifies the exact `evenAppMessage` method call,
  `compressMode: 2` payload, and successful host-response normalization.
- `npm test`: 58 files and 512 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: 152 modules transformed and the production build completed.
- `npm run test:sites`: 4 tests passed.
- `node --test --test-concurrency=1 tests/*.test.mjs`: 147 tests passed.
- `npm run test:repo`: 5 tests and the repository copy check passed.
- `npm run pack`: produced `sandevistan.ehpk` at 1,772,324 bytes.
- EHPK SHA-256:
  `d5a6ef3378086baa406a78bddd82ca6a5b1fe3ebe4f5a8a0b0e0e74da3e8cda2`.
- Installed versions: Even Hub SDK `0.0.13` and Even Hub CLI `0.1.13`.
- Client source and production bundle contain no embedded ORS credential
  marker.

## Physical Test Sequence

1. Close any active Sandevistan Mini App session.
2. Open the SDK `0.0.13` candidate URL.
3. If the first tile returns `sendFailed`, stop immediately. Copy the trace.
4. If startup succeeds, confirm that all four quadrants appear in both eyes.
5. Scroll once through Overview, News, TODO, Weather, and Navigation.
6. Open and close the map, news, TODO, Weather, and Navigation details.
7. Confirm map zoom, continued news text, and TODO toggle behavior.
8. Hide and restore the HUD at least five times.
9. Issue one extra input during an active refresh and confirm it is dropped.
10. Leave the WebView active across two minute boundaries.
11. Copy the complete WebView trace.

## Physical Acceptance Checklist

- [x] The first image tile does not return `sendFailed`.
- [x] All four tiles complete and appear in both eyes.
- [x] No quadrant is blank, corrupt, shifted, mixed, or stale.
- [x] Page order and input direction are unchanged.
- [x] Fullscreen detail interactions are unchanged.
- [x] Repeated hide and restore completes without a stale frame.
- [x] A competing live refresh is dropped and never replayed later.
- [x] No automatic retry or refresh queue appears.
- [x] No tile timeout or unhandled SDK exception appears.
- [x] The WebView remains responsive through the observed minute boundary.

## Physical G2 Result

The owner supplied a physical trace from the updated Even App and G2 firmware
on 2026-07-31. The installed package was SDK `0.0.13`; the result confirms that
the compressed image path introduced in SDK `0.0.12` now works on the repaired
host combination.

| Operation | Samples | Median payload | Median encode | Median refresh |
| --- | ---: | ---: | ---: | ---: |
| Four-tile restore | 5 | 22,759 bytes | 92 ms | 2,098 ms |
| Two-tile page change | 4 | 9,532 bytes | 61.5 ms | 852.5 ms |
| Four-tile black hide | 5 | 4,704 bytes | 20 ms | 393 ms |

The trace also includes a four-tile detail entry at 897 ms and a full detail
redraw at 1,953 ms. Every recorded tile completed successfully. There was no
`sendFailed`, timeout, retry, queue growth, deferred replay, unhandled SDK
exception, corrupt quadrant, missing eye, or WebView stall. Live news updates
that arrived while transport was busy were dropped, preserving the fail-fast
transport contract.

The previous SDK `0.0.11` restore sample had a 1,972 ms median. The 2,098 ms result differs by 126 ms, or 6.4 percent. The samples used different app, firmware, and content states. This comparison supports compatibility, not a controlled performance claim.

## Failure Rule

Any future `sendFailed`, timeout, missing eye, corrupt tile, queued replay, or
WebView stall rejects that build. The operation is not retried. SDK `0.0.13` is
the supported default after this physical gate. SDK `0.0.11` remains available
through repository history, while `?pipeline=1&levels=original` remains the
same-SDK transport rollback.

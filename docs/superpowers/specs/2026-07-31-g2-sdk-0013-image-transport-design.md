# G2 SDK 0.0.13 Image Transport Experiment Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

**Date:** 2026-07-31

**Branch:** `experiment/g2-sdk-0013`

**Status:** Approved for isolated implementation and physical G2 verification

## Summary

Sandevistan currently pins `@evenrealities/even_hub_sdk` `0.0.11` because the
first image update sent by SDK `0.0.12` returned `sendFailed` on the physical
G2. Even Realities has now reported that the faulty compressed-image path was
fixed, and the owner has updated both the Even App and the glasses firmware.

The npm registry identifies `0.0.13` as the current SDK release for this experiment.
Its package metadata requires Even App `2.2.6` or later.
Its public API remains compatible with `0.0.12`, including the internal LZ4 image-update path.
Upgrade only the SDK and compatibility metadata.
Preserve the hardware-proven renderer, transport scheduling, and input acceptance rules.

## Goals

- Pin the official Even Hub SDK exactly to `0.0.13`.
- Set `app.json.min_sdk_version` to `0.0.13` and
  `app.json.min_app_version` to `2.2.6`.
- Confirm that `ImageRawDataUpdate` still selects the SDK compression contract
  without changing Sandevistan's caller payload.
- Test the repaired compressed-image path on the updated Even App and G2
  firmware.
- Keep the existing `main` server and `0.0.12-reproduce` branch untouched.
- Preserve an immediate SDK `0.0.11` rollback reference.

## Non-Goals

- Changing Canvas rendering, HUD content, tile geometry, or visual levels.
- Changing the four-call transport pipeline or tile order.
- Adding retries, pending refreshes, catch-up work, or any refresh queue.
- Promoting SDK `0.0.13` to `main` before physical G2 approval.
- Rewriting or rebasing the historical `0.0.12-reproduce` branch.
- Combining this SDK gate with the rejected two-bit indexed PNG experiment.

## Fixed Baseline

The experiment starts from `main` commit
`09d750bf81314c352cf4e0c2414b9483e304688a` and preserves:

- one 576 x 288 Canvas split into four 288 x 144 image tiles;
- visible `hud-4` palette encoding through the existing Canvas PNG path;
- four in-flight SDK image calls;
- full-frame tile order `3/5/2/4`;
- right-side page refreshes on tile IDs `3/5`;
- unchanged-tile skipping;
- immediate busy-drop behavior with no queued refresh replay;
- black-frame hide and current-frame restore;
- all phone companion, localization, live data, and input behavior.

## Version and Runtime Contract

The experiment changes the following values together:

| Field | Baseline | Candidate |
| --- | --- | --- |
| npm dependency | `0.0.11` | `0.0.13` |
| `app.json.min_sdk_version` | `0.0.11` | `0.0.13` |
| `app.json.min_app_version` | `2.0.0` | `2.2.6` |
| test URL SDK marker | `0.0.11` | `0.0.13` |
| test build marker | `fast-default-040` | `sdk-0013-repair-042` |

The SDK dependency remains an exact version without a range. The CLI stays at
its current version because the npm registry exposes no newer CLI release.

## Test Isolation

The existing `main` server remains on port 4177. The candidate runs from the
isolated worktree on port 4179:

```text
http://100.127.255.11:4179/hud-canvas-fast?sdk=0.0.13&build=sdk-0013-repair-042
```

The known-good rollback reference remains:

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040
```

Only one Mini App URL may be opened at a time during physical testing. The
candidate must not reuse port 4177 or modify the running baseline process.

## Automated Contract

Tests must prove that:

- package, app minimum SDK, app minimum version, and QR metadata use the exact
  candidate versions;
- `ImageRawDataUpdate.toJson()` emits `compressMode: 2` with the original
  container fields and byte values;
- the default route still resolves pipeline four and `hud-4`;
- the explicit serial/original rollback query remains available;
- the test suite, type checker, production build, Sites tests, server tests,
  repository copy checks, and package build all pass serially;
- the production bundle contains SDK `0.0.13` and no embedded ORS credential.

## Failure Handling

If a tile returns `sendFailed`, times out, or throws, fail the active refresh.
Do not retry or queue it.
A later independent user or live-data event may request another refresh.
Immediately drop inputs received while a refresh is active.
Do not compensate for SDK or device failures.

The test server and WebView trace must report enough information to identify:

- SDK and build markers;
- four tile starts and results;
- active in-flight count;
- encode and refresh duration;
- `sendFailed`, timeout, or thrown errors;
- expected busy and hidden drops.

## Physical Acceptance Gate

The candidate is compatible only if all of the following pass on the updated
Even App and G2 firmware:

1. Startup sends all four tiles without `sendFailed` and displays in both eyes.
2. Overview, News, TODO, Weather, and Navigation pages render in the approved
   order and page changes remain responsive.
3. Fullscreen details, map zoom, news continuation, and TODO toggling work.
4. Double-tap hide and restore work repeatedly without a stale or mixed frame.
5. Inputs during an active refresh are dropped and never replayed later.
6. No retry, queue growth, WebView stall, or delayed catch-up appears.
7. The app remains responsive across at least two minute boundaries.

If startup fails, physical testing stops after the first complete diagnostic
record. SDK `0.0.11` remains the supported default. If compatibility passes,
the physical trace and latency comparison are documented before any separate
promotion decision.

## Rollback

The candidate is isolated on `experiment/g2-sdk-0013`. Reloading the port 4177
reference immediately returns to the proven SDK `0.0.11` build. No merge,
force-push, branch deletion, or automatic promotion is part of this experiment.

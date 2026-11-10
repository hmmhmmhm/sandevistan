# SDK 0.0.10 Image transmission A/B diagnostic design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Background

On the actual G2, the root route's first `288×144` PNG tile returned `SENDFAILED`.
The click-triggered `200×100` 1-bit BMP in `/diagnostic-v10` also failed.
The two experiments differ in format, size, and timing, but use the same SDK-to-glasses transmission steps.

The current app uses `@evenrealities/even_hub_sdk` `0.0.12`.
The official image template uses `0.0.10`.
When serializing the same `ImageRawDataUpdate`, only `0.0.12` adds `compressMode: 2`.
The `0.0.12` changelog says image transmission added LZ4 compression.

## Target

Lower only the SDK version to `0.0.10`. Keep the Even app and G2 firmware unchanged.
Test whether `SENDFAILED` is related to the compressed transmission mode in `0.0.12`.

This is a one-time A/B diagnostic to isolate the cause.
It does not select an SDK downgrade as the product direction.

## Selected access

Pin the SDK to exactly `0.0.10` in the local diagnostics branch.

- Set the SDK version of `package.json` and lockfile to `0.0.10`.
- Set the minimum SDK version and version contract test of `app.json` to `0.0.10`.
- Page definitions in `/diagnostic-v10`, 1-bit BMP bytes, click triggers and transfers
  The order does not change.
- Change only the `build` identifier of QR to `sdk-0010-ab` to distinguish it from the previous WebView.
- Uses the same `4173` port as the current Tailscale server.

## Alternatives considered

### Remove only `compressMode` from `0.0.12` request

Removing the property requires bypassing SDK internal serialization, outside the official API contract.
If transmission fails, the result cannot distinguish an SDK version problem from a bypass-code problem.
Reject this approach.

### Update Even app and G2 firmware first

Updating is desirable for production, but it changes the app, firmware, and connection sessions together.
Those changes add too many variables to this A/B experiment.
Update them in a separate step after recording the SDK comparison.

## Data flow

1. `/diagnostic-v10` creates or reconfigures the three existing container pages.
2. Mark ‘TEXT READY - CLICK TO SEND’ on the glasses.
3. User clicks once.
4. Insert the existing `200×100` 1-bit BMP into `ImageRawDataUpdate`.
5. SDK `0.0.10` serializes image requests without `compressMode: 2`.
6. Display the normalized image transmission results in WebView.

## Interpretation of results

| Results | Interpretation | Next steps |
|---|---|---|
| `success` | Compatibility issues between `0.0.12` compressed transfer mode and current host environment | Re-verify `0.0.12` after app/firmware update |
| `SENDFAILED` | SDK compression mode is not the main cause | Restore to `0.0.12` and diagnose app/firmware/BLE connection status |
| Other image errors | Differences in image conversion behavior by SDK version | Re-verify the same version with the official `sample.png` |

Record one result without automatic retries.
Retries can hide intermittent BLE failures and obscure the A/B comparison.

## Test

- Check that version-contract tests require SDK `0.0.10` in `package.json` and `app.json`.
- Pass the existing click-trigger and BMP transmission-order tests unchanged.
- Run the full Vitest suite, TypeScript checks, production build, and Sites package inspection.
- Check that the Tailscale diagnostic URL returns HTTP `200` and port `4173` has one listener.

## Success Criteria

- Other than the SDK version, the image transfer operation does not change.
- All automatic verification passes.
- Reproduce either `success` or `SENDFAILED` after one click in the new QR
  Record the results.
- Depending on the results, the next step is either restoring SDK `0.0.12` or updating the host.
  It is decided as one.

## Hardware result

- SDK: `0.0.10`
- Build: `sdk-0010-ab`
- Trigger: one manual G2 or R1 click
- Result: `success`
- Optical observation: a very small dot/checker pattern was visible on the G2.
- Interpretation: the SDK `0.0.12` image transport change is incompatible with
  the current Even app or G2 firmware environment.
- Next: update the Even app and G2 firmware, then retest SDK `0.0.12`.

## Full HUD follow-up result

- SDK: `0.0.10`
- Build: `hud-4tile-sdk0010`
- Layout: four `288×144` image containers covering the `576×288` display
- Result: all four tiles rendered successfully on the physical G2
- Optical observation: the full HUD was very clear and felt larger than the
  centered `200×100` diagnostic pattern
- Size conclusion: this layout already fills the maximum SDK raster area;
  future size changes must scale content within the same frame

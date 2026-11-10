# G2 SDK 0.0.12 LZ4 transmission experiment design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-28

Status: Approved for custom implementation

## Target

Preserve the HUD verified on the physical G2 with SDK `0.0.11`.
Upgrade only the SDK to `0.0.12`.
Test whether its official LZ4 image path improves four-tile Canvas HUD transmission time and stability.

## Baseline

- remote preservation branch: `origin/feature/g2-ors-routing`
- Baseline commit: `90a9421`
- Base SDK: `0.0.11`
- Base build: `weather-icon-029`
- Transmission format: 288×144 PNG four tiles
- Overall transmission order: top right, bottom right, top left, bottom left
- Prohibit simultaneous transmission, prohibit loading of update requests, discard busy requests immediately

## Approach

### Adoption: Replace only SDK

Update the SDK dependency and experiment URL marker to `0.0.12` in `package.json`, the lockfile, and `app.json`.
Keep Canvas encoding, tile size, transmission order, timeout, and busy-drop behavior unchanged.
This isolates the SDK transmission path for the hardware comparison.

### Pending: Skip change tile

Skipping unchanged tiles may help, but combining that change with the SDK upgrade would prevent attribution of any speed improvement.
Run it as a separate experiment after recording the `0.0.12` hardware results.

### Pending: Canvas·Official Text Mix

Combining Canvas and native text may improve perceived transition speed, but it changes the rendering structure.
Exclude that change from this SDK compatibility test.

## Compatibility and failure handling

- SDK dependencies are set exactly to `0.0.12` without range notation.
- Set `app.json.min_sdk_version` to the same version.
- Image update calls are serially `await` only within a single authorized refresh.
- Do not queue refresh events or retry failed requests.
- If `sendFailed`, a timeout, or WebView freeze occurs, the event fails.
  Finish it and leave it to the next user event.
- Experiment changes are not pushed remotely before physical G2 approval.

## Practical success conditions

1. Check that startup displays all four tiles in both eyes.
2. Check dashboard paging, detail entry and return, and hiding and restoration.
3. For the same operation, require each tile's transmission time to improve or remain no worse than the `0.0.11` baseline.
4. Check for repeated `SENDFAILED`, input stalls, WebView freezes, and delayed updates.
5. Check diagnostic logs for serial transmission and immediate dropping of busy input.

## Automatic verification

- Test the pinned SDK, app minimum version, and QR experiment marker.
- Test the LZ4 contract: `ImageRawDataUpdate` JSON adds `compressMode: 2` without changing caller input.
- Run full Vitest serially.
- Run Sites Node tests serially.
- Run TypeScript checks.
- Run the Vite production build.
- Check that the Tailscale experiment URL returns HTTP 200.

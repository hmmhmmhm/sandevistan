# First successful record of G2 image transmission

> Historical G2 record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Summary

On 2026-07-26, Sandevistan transmitted images to a physical Even G2 for the
first time. The confirmed SDK for this checkpoint was
`@evenrealities/even_hub_sdk` `0.0.10`.

The following two routes succeeded consecutively on the same device and Even app session.

1. `/diagnostic-v10`: one user click sends a `200×100` 1-bit BMP.
2. `/`: four `288×144` PNGs compose the complete `576×288` HUD.

The diagnostic BMP showed a small dot pattern. With all four tiles visible, the
user reported that the full HUD was clear and appeared larger than the
diagnostic BMP.

## Comparison of initial failure and success

| order | SDK | path | Image and viewpoint | Real G2 Results |
|---:|---|---|---|---|
| 1 | `0.0.12` | `/` | Immediately after starting, four `288×144` Canvas PNG | `SENDFAILED` in first `relicTL` |
| 2 | `0.0.12` | `/diagnostic-v10` | After clicking `200×100` 1-bit BMP | `SENDFAILED` |
| 3 | `0.0.10` | `/diagnostic-v10` | Same Click, Same BMP | `success`, display small dot pattern |
| 4 | `0.0.10` | `/` | Same 4-tile full HUD | All four tiles displayed, the screen is crystal clear |

The second experiment excluded automatic transfer timing and large-PNG-specific issues as sufficient explanations. The third experiment changed only the SDK version. The image, container, click timing, and device stayed the same.

## Changes that created success

The successful build pinned the SDK to exactly `0.0.10` and matched the related metadata.

```json
{
  "dependencies": {
    "@evenrealities/even_hub_sdk": "0.0.10"
  }
}
```

```json
{
  "min_sdk_version": "0.0.10"
}
```

`0.0.12` adds the following fields to the result of `ImageRawDataUpdate.toJson()`.

```json
{
  "compressMode": 2
}
```

`0.0.10` serializes the same image request as follows:

```json
{
  "containerID": 3,
  "containerName": "frame",
  "imageData": [1, 2, 3]
}
```

`src/sdk-version.test.ts` checks SDK, app-manifest, and QR metadata for `0.0.10` consistency and the absence of `compressMode`. Preserve this contract test. Before upgrading to `0.0.12`, verify the replacement transport contract.

## Reproduction Procedure

### 1. Prepare dependencies and verification status

```bash
npm ci
npm ls @evenrealities/even_hub_sdk
npm test
npm run typecheck
npm run build
npm run test:sites
```

The `npm ls` result should be `@evenrealities/even_hub_sdk@0.0.10`.

### 2. Run Tailscale server

Turn on and run Tailscale on your Mac and iPhone.

```bash
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

At initial success, the Mac's Tailscale IPv4 was `100.96.68.73`. If the address changes, update the URL below with the result of `tailscale ip -4`.

### 3. Small manual transfer confirmation

```bash
npx evenhub qr \
  --url "http://100.96.68.73:4173/diagnostic-v10?sdk=0.0.10&build=sdk-0010-ab" \
  --external
```

Scan the QR in the Even Hub developer area of ​​the Even app.
When you see ‘TEXT READY - CLICK TO SEND’, press R1 or the G2 touch bar once.
The success status is ‘1-bit BMP transmission completed’.

### 4. Check the entire HUD

```bash
npx evenhub qr \
  --url "http://100.96.68.73:4173/?sdk=0.0.10&build=hud-4tile-sdk0010" \
  --external
```

The app automatically sends the entire HUD. Verify successful transfers in this order: `relicTL`, `relicTR`, `relicBL`, `relicBR`.

## Compare maximum display area

On the same day, `/calibration-max` sent an outer band, auxiliary border, central cross, and 32-pixel scale across four tiles.

The following URL was used for actual testing.

```text
http://100.96.68.73:4174/calibration-max?sdk=0.0.10&build=max-boundary-001
```

The user switched between the calibration pattern and the G2 system dashboard. The user confirmed that their visible outlines had the same size.

This observation applies to the tested wearing position and screen-height settings. The `576×288` coordinate area appeared no smaller than the system dashboard. It does not establish the dashboard's internal resolution or pixel mapping to the physical panel.

The comparison narrowed the apparent size difference to black margins, lit-pixel density, brightness, or native stereoscopic layers. It did not identify a smaller coordinate limit.

## High-density Canvas HUD actual device results

The revised `/hud-canvas` drew a `576×288` HUD with Canvas primitives and text instead of the original image. The same SDK `0.0.10` tile path displayed it normally on the physical G2.

The results confirmed by the user are as follows.

- The time and text were large and clearly readable.
- Map size and route visibility were satisfactory.
- The entire exterior felt the same size as the system dashboard.
- Closed square borders and large filled arrows made it look more like a dashboard than a game HUD.
- The next agreed priority was to combine the small ACC and News sections and enlarge the News text.

This hardware check confirmed the maximum display area, direct Canvas rendering, four-tile transfer, and large-text readability.

## Tactical HUD candidate `tactical-hud-002`

The next candidate that reflects the above feedback maintains the transmission protocol and screen size as is.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=tactical-hud-002
```

The changes are as follows:

- ACC and X/Y/Z values ​​were removed.
- The bottom right corner has been integrated into a `164×138` news/mission card.
- ‘To the subway station’ was enlarged to 17 pixels, and ‘Move’ was enlarged to 24 pixels.
- The closed square panel was replaced with an open corner bracket.
- The map route and center rotation instructions have been unified into a double line.

The following physical G2 checks remained pending.

- [ ] The news text is clearly read larger than the existing 10-pixel text.
- [ ] The open corner frame divides the area without interruption in G2.
- [ ] The dual routes of the map and central directions are not lumped together.
- [ ] Key information is not lost at the four tile boundaries.
- [ ] Maintains the overall size and clarity of the existing Canvas version.

## Information extension candidate `hud-info-003`

Added second-by-second time, weather line, and TODO check status to tactical HUD candidates.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=hud-info-003
```

The Canvas shows local time as `HH:MM:SS` when drawn. It sends the four tiles only once, so seconds do not update continuously. `HONGDAE 23°C CLEAR` and the other HUD content remain static mockups.

TODO cards draw empty boxes, completed boxes, and check marks as Canvas shapes. These shapes distinguish states in the G2 monochrome raster without font glyphs.

The following physical G2 checks remained pending.

- [ ] `HH:MM:SS` is not truncated within the time frame.
- [ ] Region, temperature, weather can be read in one line.
- [ ] Incomplete boxes and complete checks are distinguished from each other.
- [ ] TODO body size remains as large as the previous mission card.
- [ ] The existing tactical frame and dual path are clear as is.

## Paged HUD candidate `paged-hud-004`

The candidate retained the dense dashboard and added four pages. G2 and R1 scroll input move between larger detail views.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=paged-hud-004
```

The page order is `OVERVIEW → NAVIGATION → NEWS → TODO`. Scrolling down from the last page returns to `OVERVIEW`. Scrolling up reverses the order. The default `OVERVIEW` shows local news and weather instead of the central route and intersection card.

Scrolling redraws the same 576×288 Canvas without rebuilding the page containers. The app updates container IDs 2, 3, 4, and 5 in the original order. A single queue serializes BLE image updates during continuous scrolling.

News, weather, maps, and to-dos remain static mockups. The following physical G2 and R1 checks remained pending.

- [ ] Immediately after refreshing, the `01 / 04` basic news screen is visible in both eyes.
- [ ] ‘Right turn’ and ‘Next intersection’ do not appear on the basic screen.
- [ ] G2 Down and up scrolling moves to the next and previous pages, respectively.
- [ ] R1 Down and up scrolling also moves in the same direction.
- [ ] If you scroll down from `04 / 04`, it will cycle to `01 / 04`.
- [ ] The phenomenon of being left with only one eye after switching pages does not recur.
- [ ] After transmission completes, all four tiles form one screen, even if partial tiles appeared during the transfer.

## Hybrid Native Text candidate `hybrid-text-005`

The A/B candidate sends a shared background without text once. Each scroll then updates native text instead of resending four Canvas images.

```text
http://100.96.68.73:4173/hud-hybrid?sdk=0.0.10&build=hybrid-text-005
```

The start page retains image container IDs 2–5 and full-screen event-capture Text ID 1. After sending all four images, it posts the first `OVERVIEW` text. Each scroll updates Text ID 1 once without changing images or page containers. A serial queue handles rapid input.

This diagnostic checks whether native text can overlay images without explicit z-order in SDK `0.0.10`. Automated tests confirmed only four initial image sends and a maximum of 1 concurrent Text update.

- [ ] Native text is displayed over the static frame/map background.
- [ ] The Canvas background is visible in the transparent area of ​​the Text container.
- [ ] ‘Line 2 operates normally’, ‘Turn right →’ Korean and arrows are read.
- [ ] `[ ]` and `[x]` check states are distinguished from each other.
- [ ] When scrolling down or up, the entire text changes at once.
- [ ] conversion is definitely faster than updating the four images in `paged-hud-004`.
- [ ] The same phrase is visible at the same time in both eyes.

If the stacking order or font display fails, keep this path for diagnostic purposes.
Continue to use `/hud-canvas` as the default candidate.

## Explicit layer candidate `hybrid-zorder-006`

In the `hybrid-text-005` hardware test, only the Canvas layout was normally visible. Native Text appeared while the System Close panel was open. It disappeared when the panel was canceled. This indicated a layer-order problem rather than a failed text transfer.

A separate route kept SDK `0.0.10` image transfer and supplied explicit `zOrderIndex` values in five container JSON objects. It assigned images 1–4 and Text 5 distinct layers.

```text
http://100.96.68.73:4174/hud-hybrid-z?sdk=0.0.10&build=hybrid-zorder-006
```

On 2026-07-26, the hardware test displayed Text above the Canvas without the close panel. Scrolling changed text immediately without resending images. The explicit `zOrderIndex` backport resolved the observed layer-order issue. The single Text update resolved the observed transition delay.

The full-screen Text flows from `(8, 8)`, but the Canvas assumes several panel coordinates. Text therefore does not align with the panel frames. Reorganize the Canvas around one Text area or position multiple Text containers. Do not simulate coordinates with spaces or line breaks.

- [x] Text is displayed on the Canvas without a close panel.
- [ ] Even if you cancel the close panel, the text remains visible.
- [x] Scroll only updates the text once without retransmitting the image.
- [x] Four image layouts and text are displayed together.
- [ ] Text is aligned exactly with the position of each panel on the Canvas.
- [ ] The same text and layout are visible on both sides.

## Single Text Console Sort Candidate `hybrid-console-007`

The candidate retained the single Text update from `hybrid-zorder-006` and aligned the Canvas frame with native text flow. The left area `(8, 8, 180,
272)` is a fixed map, and `(196, 8, 372, 272)` on the right is one text console.

The Text container matches the right console coordinates and size, with `8px` padding. The candidate removes horizontal dividers tied to native row height. Each page has two common-status lines, one blank line, and five page-information lines.
When scrolling, only one text string is updated without retransmitting the image.

```text
http://100.96.68.73:4174/hud-hybrid-z?sdk=0.0.10&build=hybrid-console-007
```

- [ ] The map on the left appears large in an independent frame.
- [ ] The entire text on the right is visible within the console frame.
- [ ] Text does not overlap on the map or frame lines.
- [ ] Four pages are switched immediately with one scroll.
- [ ] The time, weather, and page number in seconds are displayed without line breaks.
- [ ] The same map and text are visible on both sides.

## Fast Split Canvas Candidate `fast-canvas-008`

A separate `/hud-canvas-fast` path tested faster Canvas transitions without native text's fixed font and brightness.
The existing multi-sections `/hud-canvas` and `paged-hud-004` were not changed.

The left `288×288` area holds the same large map on every page. The right `288×288` area holds time, weather, page number, and page content. Key text uses `20–28px`. The four palette levels are `#ffffff`, `#d0d0d0`, `#808080`, and `#000000`.

Startup sends image IDs `2, 3, 4, 5`. Scrolling redraws the full Canvas but encodes and serially sends only `relicTR` and `relicBR`, IDs `3, 5`.

```text
Existing: http://100.96.68.73:4174/hud-canvas?sdk=0.0.10&build=paged-hud-004
New: http://100.96.68.73:4174/hud-canvas-fast?sdk=0.0.10&build=fast-canvas-008
```

On 2026-07-26, the user approved the fixed left map and page-specific right information area on the physical G2. A later scroll test confirmed that transitions felt very fast. The user accepted the sequential right-tile update without disruptive seams. This approval established `fast-canvas-008` as the technology and design baseline.

- [x] I am satisfied with the new structure that divides the left map and right information.
- [x] Key letters on the new screen are larger and brighter to read than on the existing Canvas.
- [x] The map on the left does not blink or change during page switching.
- [x] The top and bottom right sides change naturally as if they were one screen.
- [x] The conversion time is shorter than the existing four-tile Canvas and feels very fast.
- [ ] Continuous scroll input preserves page order.
- [ ] The same map and information are visible in both eyes.
- [x] Adopt the current structure and transmission method as the technology and design baseline.

Continuous scrolling and binocular matching remained separate regression checks. They did not block the recorded baseline adoption.

## Content candidate `fast-content-009`

This candidate changed page order and sample content while preserving the approved split layout and transport contract.

1. `OVERVIEW`: Single G1/G2/R1 battery returned by SDK, weather, TODO progress
2. `NEWS`: Six general article titles instead of map and transportation samples
3. `TODO`: Three checkboxes and today’s completion progress
4. `NAVIGATION`: Information on the existing 120m right turn and the next intersection

The clock uses `HH:MM` without seconds. In SDK `0.0.10`, `getDeviceInfo()` returns one device's battery and charging status. It does not list all devices. The app queries battery status once before initial image encoding. If that query fails, it shows `BATTERY --` and continues tile transfer. Device events and per-second timers do not automatically resend images.

```text
Baseline: http://100.96.68.73:4174/hud-canvas-fast?sdk=0.0.10&build=fast-canvas-008
Content: http://100.96.68.73:4175/hud-canvas-fast?sdk=0.0.10&build=fast-content-009
```

- [ ] OVERVIEW shows the actual single device battery or `BATTERY --`.
- [ ] The clock appears as `HH:MM` without seconds.
- [ ] Downward scrolling follows OVERVIEW, NEWS, TODO, NAVIGATION.
- [ ] NEWS's six general article titles are read separately.
- [ ] At the bottom of TODO, ‘Complete 1 / 3’ is displayed instead of the connection status.
- [ ] NAVIGATION is the fourth, and the existing right turn guidance is maintained.
- [ ] When scrolling, the map on the left is fixed and only the two tiles on the right change quickly.

## Display toggle candidate `fast-sleep-010`

This candidate added ‘YYYY.MM.DD day of the week’ below the clock. Time uses `HH:MM` without automatic minute-by-minute retransmission.

SDK `0.0.10` does not have a public API to put the display to sleep while maintaining the app.
Therefore, we replaced the double-tap exit call with the Show Next toggle only in fast Canvas.

- Double tap during display: Serial transmission of black image ID `2, 3, 4, 5`
- Scroll while hidden: no page changes and no image transfers
- Double tap while hiding: Serial restoration of current HUD image ID `2, 3, 4, 5`
- Hiding/restoration failure: Maintain the existing display status and retry with the next double tap.

The image containers and event-capture text layer remain active to receive G2 and R1 double taps. Black pixels hide the HUD. This is not an official low-power mode. Other paths, such as `/hud-canvas`, retain double-tap termination.

Only the WebView preview uses a green `#91ff73` multiply layer. The candidate removes the radial background glow and frame shadows. The transmitted Canvas retains `#ffffff`, `#d0d0d0`, `#808080`, and `#000000`.

```text
Content: http://100.96.68.73:4175/hud-canvas-fast?sdk=0.0.10&build=fast-content-009
Toggle display: http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.10&build=fast-sleep-010
```

- [ ] `YYYY.MM.DD day of the week` is displayed without overlapping with the weather and page number.
- [ ] WebView preview is green and has no luminous effect.
- [ ] G2 Double tap to turn off all HUD pixels.
- [ ] Even double tapping R1 turns off all HUD pixels.
- [ ] Even if you scroll while hidden, the HUD does not appear or the page does not change.
- [ ] A second double tap restores the page shown before hiding.
- [ ] After restoration, page conversion speed is the same as before.
- [ ] The double tap exit behavior of other HUD paths is maintained.

## Current Conclusion

On the tested Even app and G2 firmware, SDK `0.0.10` image transfer worked and SDK `0.0.12` returned `SENDFAILED`. The A/B results strongly indicate incompatibility between the new transfer method and that host environment.

This record cannot identify whether the incompatibility was in the Even app, G2 firmware, or both. The exact app and firmware versions were not collected.

## Safe next steps

- The current operating baseline is maintained as SDK `0.0.10`.
- To make the HUD appear larger, enlarge central content and increase lit-pixel density within the existing screen coordinates.
- Record the Even app and G2 firmware versions and update them.
- Retest SDK `0.0.12` only in the separate diagnostic branch.
- Before promoting `0.0.12` to the default branch, verify both the manual BMP and full HUD on hardware.

## Related commits

- `f094089`: SDK `0.0.10` A/B contract and serialization test
- `ca81e0a`: Manual BMP hardware success log
- `a1a1dcf`: HUD success record for all 4 tiles
- `69bac2c`: Successful record of high-density Canvas HUD practical device

## References

- [Even Realities official image template](https://github.com/even-realities/evenhub-templates/tree/main/image)
- [SDK `0.0.12` npm package](https://www.npmjs.com/package/@evenrealities/even_hub_sdk/v/0.0.12)

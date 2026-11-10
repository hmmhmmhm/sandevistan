# G2 hybrid z-order backport experimental design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Background and practical evidence

With SDK `0.0.10`, `/hud-hybrid` first sends four Canvas background tiles without text.
It then updates full-screen Text container ID 1.
On the actual G2, only the Canvas layout was visible.
Text appeared when the system close panel opened and disappeared when the panel was cancelled.

This observation points to a Text layer-order problem rather than failed text transfer or glyph rendering.
Calling `textContainerUpgrade()` last does not change the container's display layer.

Official SDK `0.0.12` added `zOrderIndex` to List, Text, and Image containers.
If any container uses this property, every container on the page must have a unique value.
Larger values appear in front.
However, image LZ4 transmission in `0.0.12` currently returns "SENDFAILED" on the Even app and G2.

SDK `0.0.10` does not declare `zOrderIndex` in its TypeScript type.
However, the model constructor and `toJson()` preserve unknown fields.
Local serialization checks preserved the injected `zOrderIndex` values in Text, Image, and startup-page JSON.

## Target

Keep the successful SDK `0.0.10` image-transfer protocol.
Add only `zOrderIndex` to the container JSON and test whether native text becomes visible over the Canvas images.

Keep `/hud-canvas` unchanged.
Preserve `/hud-hybrid` to reproduce the failure.
Use `/hud-hybrid-z` as the new A/B route.

## Layer contract

In both the new startup page and rebuild page, assign each of the five containers a unique layer number.

| container | ID | layer |
|---|---:|---:|
| Top left Canvas image | 2 | 1 |
| Top right Canvas image | 3 | 2 |
| Bottom left Canvas image | 4 | 3 |
| Bottom right Canvas image | 5 | 4 |
| Full screen event Text | 1 | 5 |

Place Text in front of the four images with the largest layer value, 5.
All layer numbers must be unique within the page.
The image tiles do not overlap, so their relative order at layers 1–4 does not affect appearance.

Inject `zOrderIndex` into the `0.0.10` model instance without upgrading the SDK.
Before hardware transfer, fail the automated test unless startup-page `toJson()` preserves all five values.

## Path and data flow

`/hud-hybrid-z` reuses the existing hybrid background and four-page text.

1. Create a start page with five containers with specified layers.
2. Serially transmit image IDs 2–5 using the existing `0.0.10` `ImageRawDataUpdate`.
3. After all four images are successful, update the `OVERVIEW` phrase in Text ID 1.
4. Down and up scrolling only updates the text once in the existing Promise queue.
5. Double-clicking exits the page as before.

The browser Canvas preview shows only the static background.
Evaluate layer order only in the Even app on the actual G2.

## Code isolation

Keep existing page creation without layers unchanged.
Expose the new page generator through a separate entry point such as `createLayeredGlassesPage()`.
Reuse only the common internal creation logic.

Share hybrid image serialization, the text-transition queue, and event handling.
Select the layered page generator only for the new route.
Add a regression test that `/hud-hybrid` receives no `zOrderIndex`.

## Error handling

- If the start page is `invalid`, it is reconstructed once using the same layer number.
- If reconstruction fails, layer page reconstruction failure is displayed in the progress status.
- If the image is `SENDFAILED`, the existing error will be maintained to determine which tile failed.
- If Text update is `false`, existing native Text errors are maintained.
- Only `/hud-hybrid-z` will fail if the host does not understand `zOrderIndex`,
  `/hud-canvas` and `/hud-hybrid` remain as comparison and recovery paths.

Do not add automatic retries or replace the SDK.
Container layer numbers must remain the only experimental variable.

## Automatic testing

- `[1, 2, 3, 4, 5]` exists without duplication in the serialized JSON of the layer page.
- The layer of Text ID 1 is 5 and is larger than all Image layers.
- There is no `zOrderIndex` in the existing `createGlassesPage()` JSON.
- Only `/hud-hybrid-z` selects the explicit layer mode.
- The first image transmission is once for each ID 2–5 and there are no additional transmissions.
- Initial and scroll text updates are each performed once.
- SDK, app manifest and QR metadata continue to be `0.0.10`.
- There is no `compressMode` in `ImageRawDataUpdate.toJson()`.

## Judgment of practical equipment

The build identifier is `hybrid-zorder-006`.

```text
http://100.96.68.73:4173/hud-hybrid-z?sdk=0.0.10&build=hybrid-zorder-006
```

The following items are judged in actual G2.

- [ ] Native text is visible on the Canvas layout even without a close panel.
- [ ] Canvas frame and map lines are visible behind the text.
- [ ] Even if you open and cancel the close panel, the text display status does not change.
- [ ] `Line 2 operating normally`, `turn right →`, `[ ]`, `[x]` are read.
- [ ] When scrolling down or up, the text changes at once without resending the image.
- [ ] All four images are sent without `SENDFAILED`.
- [ ] The same layout and text are visible on both sides.

If text displays correctly, the explicit layer configuration can become the hybrid HUD default.
If the page returns `invalid` or an image returns `SENDFAILED`, record the backport as unsupported on the current host.
Keep the existing Canvas HUD as the default candidate.

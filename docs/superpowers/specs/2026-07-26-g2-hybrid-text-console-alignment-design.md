# G2 Hybrid Text Console Alignment Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

Correct the Text and Canvas coordinate mismatch while preserving the fast page transitions and clear native text confirmed in `/hud-hybrid-z`.

## Confirmed cause

In SDK `0.0.10`, a Text container supports `xPosition`, `yPosition`, `width`, `height`, and `paddingLength`.
After opening the page, `textContainerUpgrade` can change only its content.
The SDK cannot specify the font, font size, line height, paragraph alignment, or coordinates of individual phrases.

The current full-screen text flows as one document from `(8, 8)`.
Canvas uses absolute coordinates for several independent panels.
Spaces and line breaks cannot align these two coordinate systems accurately.

## Approaches reviewed

### 1. Map on the left and single text console on the right

Keep a fixed `180px` Canvas map on the left.
Use a single `372px` native Text console on the right.
Do not draw internal dividers that depend on text line height.
Adopt this approach to preserve the map and one text update per transition.

### 2. Full-screen single Text console

Sorting is easiest if you simplify the entire screen into one large frame. However, if the user
The preferred large map has disappeared and the visual characteristics of the HUD have become weaker, so it is not adopted.

### 3. Multiple Text containers

By placing a separate Text container for each panel, you can maintain the existing panel coordinates.
However, since it needs to be updated multiple times per scroll, the transition is performed as soon as it is already confirmed.
It is not adopted because it may be lost or the phrases may change sequentially.

## Layout

- Keep the Canvas at `576×288`.
- Place the left map frame at `(8, 8)` with size `180×272`.
- Place the right Text console at `(196, 8)` with size `372×272`.
- Keep the existing four image tiles on layers 1–4.
- Give the layer 5 Text container the same coordinates and size as the right frame.
- Set its inner margin to `8px`.
- Do not draw text on Canvas.
- Use only outlines, corner marks, and short marks in the right frame. Do not align horizontal dividers to Text rows.
- Keep the layout and transmission behavior of `/hud-canvas` and `/hud-hybrid` unchanged.

## Text composition

Compose each page from two common status lines, one blank line, and five page-information lines.
Each page has eight lines. On scroll, replace the entire string once.

1. Time in seconds, weather, page number
2. `RELIC // LIVE`, location
3. Blank line
4. Page title
5–8. News, navigation, TODO or connection status

Keep each line short to avoid word wrapping within the width of the right console.
The basic page order and contents are `overview`, `navigation`, `news`, and `todo`.
Use it as is.

## Data flow

At startup, draw the Canvas background once and send its four tiles.
On the same startup page, create the right Text container at layer 5.
On scroll, use the existing circular page calculation.
Send the new eight-line string with one `textContainerUpgrade` call.
Do not resend image tiles.

## Error handling

If the Canvas 2D context is unavailable, or an image transfer or text update fails, use the existing status-reporting path.
Do not add retries or a separate recovery flow.
If text disappears on the actual device, investigate a layer regression.
If text extends outside the frame, investigate a line-length regression.

## Verification

- Check that the new Canvas is `576×288` and contains no text.
- Check map-frame and Text-console coordinates against the design values.
- Check that the layer 5 Text container uses the right console coordinates, size, and margins.
- Check that all four pages have eight lines, including common time, weather, and page-number content.
- Retain regression checks for one text update and no image update per scroll.
- Run the full unit tests, type checking, production build, and Sites output inspection.
- At the Tailscale test address, check alignment and binocular display on the actual G2.

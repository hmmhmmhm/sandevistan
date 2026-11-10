# G2 Hybrid Native Text HUD Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Target

Test a separate path to reduce the slow, four-part page transitions of the existing 4-tile Canvas HUD.
Send the background images once.
For later page transitions, update only one full-screen native Text container.

The verified 4-tile path of the existing `/hud-canvas` and SDK `0.0.10` will not be changed.
The new experimental path is `/hud-hybrid`.

## Page composition

On the start page, create the same five containers as before.

- ID 1 `eventLayer`: 576×288 Text, transparent background, event capture, dynamic page text
- ID 2–5: Four 288×144 images, common tactical background without text

At startup, create the Text container with a single space.
After all four images finish sending, send the first `OVERVIEW` text to ID 1 with `textContainerUpgrade()`.
SDK `0.0.10` has no explicit z-order. This hardware A/B test checks whether the final text update appears over the images.

## Common Canvas background

`drawHybridHudBackground()` draws only the following static elements on a 576×288 Canvas.

- Black background and white/gray tactical frame
- 64 pixel header separator line
- Left area map roads and routes
- Common divider and corner decoration in right information area

Do not draw text on Canvas.
Keep all changing information in native text, including news, time, weather, TODOs, and page numbers.

## Native page text

`formatHybridHudText(page, now)` returns one string with spaces and line breaks.
Keep the existing page order.

1. `OVERVIEW`: Current time, Hongdae weather, local news and brief status
2. `NAVIGATION`: Destination, distance, right turn and next intersection
3. `NEWS`: Big local headlines and weather briefings
4. `TODO`: To-do check status and G2/R1 connection status

Each page includes its page number, from `01/04` to `04/04`.
On the actual G2, check Korean text, arrows, and check marks in the built-in font.
Do not require the native text to match each Canvas letter's size, font, or pixel coordinates.

## Transmission and Input

On initial entry, send image IDs 2, 3, 4, and 5 serially as before.
On later scrolls, do not encode images or call `updateImageRawData()`.

- `SCROLL_BOTTOM_EVENT`: Update next page text once
- `SCROLL_TOP_EVENT`: Update previous page text once
- `DOUBLE_CLICK_EVENT`: Existing shutdown behavior

Process rapid inputs in order through one Promise queue.
If `textContainerUpgrade()` returns `false`, display an error in the progress status.
Catch queue errors so the next input can run.

## Judgment criteria

Automated testing fixes:

- Check that the common background Canvas is 576×288 and never calls `fillText()`.
- Check that all four pages contain unique content and a page number.
- Send image IDs 2–5 only once, on initial entry.
- After four image sends, perform one initial text update.
- On each down or up scroll, update text once without sending images.
- During continuous scrolling, permit at most 1 text update at a time.
- Select the hybrid renderer only for `/hud-hybrid`. Keep the existing `/hud-canvas` renderer unchanged.

In actual G2, check the following.

- Text is displayed on top of the image and does not cover the background.
- Hangul, `→`, `[ ]`, and `[x]` are read.
- When scrolling down or up, the entire text changes at once.
- The conversion speed is definitely faster than the existing four image updates.
- Both eyes switch to the same phrase at the same time.

If the overlap order or font display fails, leave `/hud-hybrid` as the diagnostic path only.
Keep the existing `/hud-canvas` as the default candidate.

## Actual device URL

The build identifier is `hybrid-text-005`.

```text
http://100.96.68.73:4173/hud-hybrid?sdk=0.0.10&build=hybrid-text-005
```

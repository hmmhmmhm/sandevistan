# G2 page type HUD design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Target

Distribute information across four pages while preserving the large text, clarity, and 4-tile transmission path of the current 576×288 tactical HUD.
The default page has no navigation guidance. Replace its central route guidance and bottom intersection card with news.
Use G2 or R1 scroll input to cycle through the pages in either direction.

## Page order

The pages cycle circularly in the following order.

1. `OVERVIEW` (`01 / 04`): Map, news headlines/summaries, microphone, simple tasks
2. `NAVIGATION` (`02 / 04`): Map, 120m right turn guidance, next intersection, microphone,
   simple to do
3. `NEWS` (`03 / 04`): Big news headlines and regional/weather briefings
4. `TODO` (`04 / 04`): Large checklist and audio/connection status

When you first open or refresh the app, it always draws an `OVERVIEW`.
At the top center of `OVERVIEW`, `NEWS // LOCAL 01`, `Line 2 operating normally`,
‘Hongik University Station Congestion Level’ is displayed as ‘average’. At the bottom center
Displays `BRIEF // 02`, `today 23°C · clear`, `precipitation 10%`.
`NAV // ROUTE 01`, `next intersection`, and `right turn` are not displayed in `OVERVIEW`.

The `NEWS` page uses larger headline cards.
The `TODO` page shows large checkboxes for "Go to the subway station", "Bring an umbrella", and "Confirm route".
Keep the static mock data from the existing prototype.
External news, weather, and map APIs are outside this scope.

## Input and status

- `SCROLL_BOTTOM_EVENT`: Next page
- `SCROLL_TOP_EVENT`: Previous page
- `DOUBLE_CLICK_EVENT`: Close the app as before

The R1 touchpad uses the same scroll events as the G2, so no separate ring branch is needed.
Forward scrolling from the last page returns to the first.
Backward scrolling from the first page returns to the last.

## Transmission stability

On initial entry, create an empty event-capture layer and four image containers.
Do not rebuild the page containers during scroll transitions.
After drawing the next page on the same Canvas, update only the image data for existing container IDs 2–5.
Avoiding page rebuilds reduces the risk of the temporary monocular display observed in earlier hardware tests.

Each transition is processed in one queue in the following order.

1. Change the page index to circular.
2. Redraw the same 576×288 Canvas.
3. Encode your PNG tiles.
4. Send one page at a time in the following order: ID 2, 3, 4, and 5.

While a transition is running, append additional scrolls to the queue instead of dropping them.
This preserves input order and prevents concurrent BLE image updates.
If a transition fails, display its status and catch the queue error so the next input can run.

## Visual rules

- Canvas size and tile border are fixed to four sheets of 576×288, 288×144.
- Maintain the existing four-color palette of black, white, medium gray, and dark gray.
- The clock displays `HH:MM:SS` at the time of page redraw.
- The current page number is displayed in `01 / 04` format on the right side of the common header.
- Maintain tactical frames, angled paths, monospaced fonts, and large key numbers and sentences.
- User-approved alternative to the initial concept of completely clearing the central reality field of view.
  Prioritize high-density dashboard configuration.

## Automatic verification

- Check that the default call draws `OVERVIEW` news content and `01 / 04`, without navigation text.
- Check unique phrases and page numbers for `NAVIGATION`, `NEWS`, and `TODO`.
- Check that all pages use 576×288 and the existing 4-color palette.
- After scrolling, check that the same four containers update in order without rebuilding the page.
- Check that scroll down and up select `next` and `previous`, respectively.
- During continuous input, permit at most 1 image transmission at a time.
- Preserve double-click exit and the one-time rebuild after initial page-creation failure.

## Check actual device

The build identifier is `paged-hud-004`.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=paged-hud-004
```

After refreshing on G2, check binocular display and the default news page.
Check scroll cycling in both directions on the glasses and R1.
During four-tile updates, check that all partial screen areas finish normally.

# G2 Fast Canvas date and display toggle design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Target

Preserve the approved split layout, content order, and 2-tile scroll transmission in `/hud-canvas-fast`.
Add the following changes:

1. Display the year, month, day, and weekday in the clock header.
2. On G2 or R1 double tap, hide or restore only display pixels without exiting the app.
3. Color only the WebView preview green to match surrounding text. Remove the glow effect.

## Date and time

Keep the existing `HH:MM` time format.
Below the time, display the date as `YYYY.MM.DD day of the week`.

```text
14:37
2026.07.27 Monday
```

Update the date and time when startup or page scrolling redraws the Canvas.
Do not retransmit images automatically every minute or second.
Keep the weather and page number on the right side of the header, clear of the date.

## SDK Constraints

SDK `0.0.10` has no API that suspends only the display while keeping the app running.
`shutDownPageContainer()` provides only two exit operations:

- `exitMode 0`: Immediate exit
- `exitMode 1`: Front panel display asking whether to exit

After calling the exit API, the same app cannot receive a double tap to restore the HUD.

## Reviewed display-hiding methods

### 1. Shutdown API

The current implementation calls `shutDownPageContainer(1)` on double tap.
This opens an exit confirmation panel and cannot restore the HUD with the same gesture.
Reject this approach for the display toggle.

### 2. Reorganized with blank event page

Remove the image containers with `rebuildPageContainer()` and keep only the event layer.
On restore, recreate the image containers and retransmit four tiles.
This hides the display but adds page rebuilds and a greater risk of restore failure or flicker.
Reject this approach.

### 3. Transfer of black image tiles

Keep the existing image containers and transparent event-capture Text layer.
On the first double tap, encode a black Canvas into four tiles and send them serially to IDs `2, 3, 4, 5`.
On the second double tap, encode the current HUD Canvas into four tiles and send them serially to the same IDs.

Adopt this approach because it hides all display pixels while retaining input events without rebuilding containers.
This is pixel hiding, not an official device or app low-power mode.

## Input and status

Apply the same toggle for every double-tap `eventSource`: right temple, left temple, or R1.

### Showing

- Scrolling down and up moves to the next and previous pages as before.
- Double tap adds a hidden task to the visible toggle queue.
- After the transmission of the four black tiles is completed, change the status to `hidden`.

### Hiding

- Down and up scrolling is ignored.
- Double tap adds a restore operation to the display toggle queue.
- After sending the four HUD tiles of the current page, change the status to ‘visible’.

Restore the page that was visible immediately before hiding.
Do not change the page index while hidden.

## Serialization and error handling

Use one serial task queue for scrolling and display toggles.
If input arrives during an image transfer, the new transfer must not overlap the current transfer.

- If hidden transmission fails, the state remains `visible`.
- If restoration transmission fails, the state remains `hidden`.
- Failure messages are displayed in the existing progress status output.
- After failure, you can try the same task again with the next double tap.
- The double tap exit behavior of paths other than fast Canvas does not change.

## Transfer Agreement

- First display: ID `2, 3, 4, 5`
- Scroll page while displaying: ID `3, 5`
- Hidden: Black image ID `2, 3, 4, 5`
- Restore: Current HUD image ID `2, 3, 4, 5`
- Scroll while hidden: no image transfer

## WebView Preview

Keep the glasses Canvas palette unchanged: `#ffffff`, `#d0d0d0`, `#808080`, and `#000000`.
Changing Canvas pixels to green would also change the encoded PNG.
Apply preview colors only through CSS.

The methods reviewed are as follows.

1. Reject redrawing Canvas pixels in green because that also changes the glasses payload.
2. Reject CSS `filter` combinations because brightness and browser differences can change the resulting color.
3. Place a `#91ff73` layer over WebView Canvas and blend with `multiply`.
   White becomes `#91ff73`, gray becomes a dimmer shade of the same green, and black stays black.
   This changes only DOM and CSS composition, leaving transmitted PNGs unchanged.

Adopt the third method.
Remove `box-shadow` from `.hud-frame` and remove the page-background radial gradient.
This removes the preview glow. Keep the border and green text.

## Test

- Check that the date uses "YYYY.MM.DD day of the week".
- Check that date, weather, and page number stay inside the header.
- Check that fast Canvas double tap does not call the exit API.
- Check that the first double tap sends four black tiles in order.
- While hidden, check that scrolling triggers neither page callbacks nor image transfers.
- Check that the second double tap restores all four current HUD tiles in order.
- During continuous input, check that only one image transfer runs at a time.
- If hiding or restoration fails, retain the previous state and allow another attempt.
- Preserve existing `/hud-canvas` double-tap exit and fast Canvas scroll IDs `3, 5`.
- Check that the WebView composite color is `#91ff73`, without shadow or radial gradient.
- Check that internal Canvas colors and transmitted image encoding preserve the existing brightness values.

## Check hardware

Check the following in the actual G2 and R1.

- Double-tapping the glasses changes the HUD to a black screen.
- The same action can be performed by double tapping R1.
- In a black state, other apps and system screens can be used normally.
- If you double-tap again, the page before hiding will be restored.
- Scrolling while hiding does not turn the screen back on.
- After restoration, the page scroll speed is the same as the existing baseline.

# G2 manual image-send diagnostic design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Goal

Determine whether `updateImageRawData()` fails because it runs automatically
during startup. The experiment changes only the trigger: v9's three-second
timer becomes an explicit glasses click.

## Diagnostic flow

1. Open `/diagnostic-v10` through the Even Hub QR scanner.
2. Create and rebuild the same three-container page used by v9.
3. Show `TEXT READY - CLICK TO SEND` in text container 2.
4. Wait indefinitely for one click from the glasses touchbar or R1 ring.
5. Remove the temporary click listener before transmitting.
6. Send the same 200×100, 1-bit checkerboard BMP as v9 to image container 3.
7. Replace the status text with the normalized SDK result.

There is no timer, DOM image, PNG conversion, or payload-format change in v10.
Double-click remains reserved for exiting and must not trigger transmission.

## Event handling

The SDK may omit the numeric zero value used for `CLICK_EVENT`. Treat an
existing `sysEvent` or `textEvent` envelope with an absent `eventType` as a
single click. Ignore unrelated events. Resolve the trigger only once and
unsubscribe before calling `updateImageRawData()`.

## Verification

Automated tests must prove this order:

`create → rebuild → announce → click → image → status`

They must also prove that a non-click event does not send an image and that
multiple click events cannot start concurrent image transfers. Type checking
and a production build must pass, and the served v10 source must contain the
manual-click status with no three-second wait on this path.

## Interpreting the hardware result

> Unresolved interpretation: These outcome rules assert a definite timing cause. This record does not establish whether one result excludes other causes.

- If click-triggered transmission succeeds, startup-time automatic sending is
  the cause. Sandevistan should require user input or a later lifecycle event
  before sending its initial raster.
- If it returns `SENDFAILED`, startup timing is ruled out. The next isolated
  experiment will preload and decode a PNG in the WebView before a manual click.
- If the click is not detected, the image path remains untested. Record event
  envelopes in the next diagnostic.

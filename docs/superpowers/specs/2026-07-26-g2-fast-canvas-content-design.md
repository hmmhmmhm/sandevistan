# G2 Fast Canvas content reorganization design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Target

Reorganize the four-page sequence and sample content in `/hud-canvas-fast`.
Preserve the layout, transition speed, and two-tile transmission behavior approved on the actual device.

## Approved page order

The scroll order rotates as follows.

1. `OVERVIEW`
2. `NEWS`
3. `TODO`
4. `NAVIGATION`

The `288×288` map on the left remains the same on all pages.
At startup, send image IDs `2, 3, 4, 5`.
On scroll, send only the right image IDs `3, 5`.
Keep the existing serial transmission behavior.

## Reviewed battery display methods

### 1. Static sample values

This method always draws a fixed value such as `G2 82%`.
Although the implementation is simplest, reject it because users could mistake the sample for actual device status.

### 2. SDK single device snapshot

Model, battery level, and charging status of a device returned by `getDeviceInfo()`
Draw before initial Canvas transfer. If G2, `G2 82%`, if R1, `R1 64%`, charge
If it is in progress, add `+` at the end. If no information is obtained, `BATTERY --` is displayed.

Currently in SDK `0.0.10` there is no public API to enumerate multiple devices simultaneously.
The values ​​of G2 and R1 cannot be guaranteed at the same time. By accurately revealing this limitation,
We adopt this method of using values.

### 3. Immediate retransmission per status event

This method resends the right tile every time `onDeviceStatusChanged()` is called.
The latest values ​​are maintained, but BLE image transmission may occur without notice for battery indication.
It happens. This is excluded as it may unnecessarily disrupt the approved fast scrolling behavior.

## Page content

### 1. OVERVIEW

The existing content, which was centered on traffic news, is changed to a summary status board.

- G2 or R1 battery returned by SDK
- Whether to charge
- Today’s TODO count and completed count
- Current weather summary

### 2. NEWS

Replace the map-like or subway-condition samples with six short general article titles.
Place four titles in the upper-right main area and two in the lower-right auxiliary area.
Keep the titles clear of the tile border.

### 3. TODO

The three existing checkboxes are maintained. The ‘G2 + R1 CONNECTED’ connection status at the bottom is
Remove it and change it to `Completed today 1 / 3` progress.

### 4. NAVIGATION

The current ‘120m’, right turn, next intersection content is maintained as is.

## Clock

Display the clock in `HH:MM` format without seconds.
The Canvas redraws only at app launch and on scroll, so the time updates only then.
Do not retransmit tiles every second. That would increase BLE traffic and battery use.

## Data flow

1. Connect to the Even app bridge.
2. Call `getDeviceInfo()` once.
3. If successful, the battery snapshot of a single device is reflected in OVERVIEW.
4. If it fails or there is no value, continue with `BATTERY --`.
5. First transmit four tiles.
6. Subsequent scrolling changes pages in the approved order and sends only the two tiles on the right.

Battery inquiry failure is not treated as HUD image transmission failure.

## Test

- Check that page order is `overview`, `news`, `todo`, and `navigation`.
- Check that the clock uses `HH:MM` without seconds.
- Check that OVERVIEW draws the actual battery, charging indicator, and unknown-value fallback text.
- Check that NEWS draws six general article titles.
- Check that TODO replaces connection status with progress.
- Check that the battery query precedes image encoding.
- If the battery query fails, check that all four initial tiles still send.
- Retain regression checks for `/hud-canvas`, initial IDs `2, 3, 4, 5`, and scroll IDs `3, 5`.

## Out of range

- Real news API connection
- Real weather API connection
- Simultaneous enumeration of G2 and R1 batteries
- Automatic image retransmission for each device status event
- Real-time clock updated every second

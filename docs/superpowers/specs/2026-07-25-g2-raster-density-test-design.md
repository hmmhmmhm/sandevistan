# Sandevistan G2 Raster Information Density Test Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date written: 2026-07-25
Status: First practical test design approved in conversation

## Purpose

Use the actual G2 optical system to check font size, information density, contrast, peripheral placement, and central visibility.
This test does not evaluate real-time data or native text styles.

## Range

- The selected HUD draft is rendered on a single 576 x 288 Canvas.
- Encode the Canvas into a quadrant PNG with a size of 288 x 144.
- Send images sequentially with Even Hub SDK.
- Leave the event capture text required by the SDK blank.
- Only double tap exit connects.

Map, location, time, STT, volume, IMU, quests and news are all in the image.
It is a fixed mock-up. Sensors, microphones, network and storage functions are not connected.

## Component

### Canvas Preview

Reduce the selected original draft to 576 x 288 in the browser.
On a phone or PC, the preview displays the same Canvas that the app transfers to the glasses.

### Tile Encoder

Create four tiles in this order: top left, top right, bottom left, and bottom right.
Each tile uses the maximum G2 Image container size of 288 x 144.

### Glasses Transmitter

Create a page with one full-screen blank Text event layer and four Image containers.
To avoid BLE conflicts, wait for each image update to finish before sending the next.
If a tile fails, display its name in the phone status text.

## Execution flow

1. WebView draws the original HUD on the Canvas.
2. Wait until the Even app bridge is ready.
3. Create a start page with 5 containers.
4. Encode the Canvas into PNG.
5. Send your PNGs sequentially starting from the top left.
6. Display completion status on your phone.

Safari has no Even app bridge, so it displays only the Canvas preview.
To test the glasses, use QR sideload in the Even app developer area.

## Error handling

- If there is no Canvas 2D Context or PNG encoding, an explicit error is displayed.
- If the start page creation result is not successful, image transmission does not start.
- The image result is judged by the SDK normalization function and the failed tile name is displayed.
- BLE image calls do not execute in parallel.

## Verification criteria

- Canvas logical size is exactly 576 x 288.
- Four image tiles cover the entire screen without any gaps.
- There is no visible native text.
- After creating the start page, send images in the order of IDs 2, 3, 4, and 5.
- Unit tests, TypeScript checks, and production builds succeed.
- The final visual evaluation is confirmed after the user checks it on the actual G2.

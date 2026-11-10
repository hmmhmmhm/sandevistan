# G2 Overview weather auxiliary information readability design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-27

Target path: `/hud-canvas-fast`

Base branch: `feature/g2-ors-routing`

Status: APPROVED

## Target

Enlarge the following two lines at the bottom right of the first `OVERVIEW` dashboard to improve actual G2 readability:

- `Feeling 31° Humidity 67%`
- `Precipitation 20%, wind 8km/h`

## Selected design

Increase both lines from 11px to 14px.
Keep their position, wording, font weight, color, and weather-value rounding unchanged.

Choose 14px to improve readability while preserving existing margins.
The 13px option makes a small change, while 15px may crowd the current frame.

## Implementation and verification

Apply 14px only to the two weather supplement lines in `src/fast-canvas-hud.ts`.
In `src/fast-canvas-hud.test.ts`, add a regression check that both lines use 14px.

After editing, run the relevant HUD test, type check, and build in sequence.
Keep only one development server on port 4176.
Use hot reload at the same `detail-decks-019` URL and wait for actual G2 confirmation.

## Exclude range

- Change size of time, date and week weather text
- Change element position or frame size
- Change color, brightness and font thickness
- Change to a different dashboard or full screen detail deck

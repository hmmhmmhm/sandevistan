# G2 Balanced OSM Labels Checkpoints

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-27
Branch: `feature/g2-fast-content`
SDK: `0.0.11`

## Stage 1: `map-labels-015`

Tested commit: `ed05675104a3c7f0d8a55e0623a42f1de1739d67`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-015`
Result: ITERATE

The user confirmed that the labels were present and visible, then requested
approximately 1.5 times larger text for comfortable reading:

> The label is visible, and you may need to increase the text size by about 1.5 times to see it well.

The checkpoint confirms OSM label collection, projection, collision layout, and physical display. The original 9px/8px font sizes still required a readability revision.

Before this checkpoint:

- source suite: 20 files, 215 tests passed serially;
- TypeScript typecheck: exit 0;
- production build: exit 0;
- Sites suite: 4/4 passed serially;
- map API suite: 8/8 passed serially;
- live test cell: 180 roads and 24 normalized label candidates;
- HUD URL: HTTP 200.

## Stage 2: `map-labels-large-016`

Tested commit: `8d3eb6f2cc58860bd5f6e26db6f47d7e1dd526c2`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-large-016`
Result: PASS

The revised build uses 14px transit/place labels and 12px road/landmark
labels. The user confirmed that the revised physical label size was
satisfactory:

> I am now satisfied with the label size.

The response directly confirms the enlarged labels' visibility and readability on hardware. It does not separately reconfirm bilateral output, page speed, or double-tap restoration. This font-only revision left the previously verified transport code unchanged.

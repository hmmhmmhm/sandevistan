# G2 Fast Blank Default Promotion Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-31

Status: Approved

## Goal

Promote the physically validated blank-page rebuild display toggle to the
query-free production default while preserving the former black-tile toggle as
an explicit diagnostic control.

## Strategy resolution

- Missing `hide`, `hide=blank`, and unknown values resolve to
  `blank-rebuild`.
- Only the exact `hide=black` value resolves to `black-tiles`.
- The explicit black route remains fail-fast and retains its existing four-tile
  behavior for comparison and emergency rollback.
- Session and transport defaults also resolve to `blank-rebuild` so direct
  callers cannot accidentally retain the obsolete production default.

## Runtime behavior

Keep the validated lifecycle during promotion.
To hide, rebuild the page with one blank full-screen event-capture container. Do not encode or send images.
To restore, rebuild the normal event layer and four image containers.
Clear successful-payload state and send all four current tiles.
Do not queue, retry, or add a fallback within the same event.

## Community measurement assessment

The reported device timing model attributes most image latency to a fixed cost
per `updateImageRawData` call. It reinforces the blank-page rebuild decision and
explains why payload-format changes produced only modest gains.

The timing model does not justify merging Sandevistan's four tiles without losing display size.
Each tile already uses the SDK maximum image-container size of 288 by 144 pixels.
The full 576 by 288 area therefore needs four maximum-size image containers.
SDK 0.0.13 has no independent image-scaling, fit, or source-dimension property.
It cannot stretch one 288 by 144 container across the full display.

Consequently:

- do not repeat PNG-versus-BMP payload experiments;
- do not replace multi-container raster updates with native text updates;
- do not claim that a one-container compact HUD preserves full-screen size;
- keep unchanged-tile skipping and targeted one- or two-tile refreshes;
- treat any future one-call HUD as a deliberately smaller 288 by 144 layout,
  not a lower-resolution full-size replacement.

## Verification

Tests must prove the query-free default, explicit black override, legacy blank
alias, and direct session/transport defaults. Existing lifecycle tests must
continue proving zero image calls on blank hide and complete four-tile restore.
Documentation must describe blank rebuild as production and black tiles as the
diagnostic control.

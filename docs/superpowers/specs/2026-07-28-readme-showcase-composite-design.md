# README Showcase Composite Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Goal

Replace the conceptual HUD image near the README top with one project-owned composite of five supplied screenshots.
Show the main dashboard, physical G2 validation, map detail, news dashboard, and full news reader together.

## Approved direction

The approved direction is the original **B — Overview-led product sheet** layout.
A later variant preserved the full aspect ratio of the bottom-right news image. It was reviewed and rejected.
Use the original B layout, including the edge crop on the bottom-right panel.

## Source roles

The five supplied PNG files have these fixed roles:

1. Overview dashboard: dominant top-left panel.
2. Physical G2 photograph: narrow top-right hardware-proof panel.
3. Full-screen map: bottom-left panel.
4. News dashboard: bottom-center panel.
5. Full news reader: bottom-right panel.

The source screenshots are compositing inputs, not style references. Their HUD
pixels, Korean copy, colors, and proportions must not be regenerated or
rewritten.

## Canvas and layout

- Final canvas: 1920×1200, 16:10 landscape.
- Background: near-black, visually continuous with the HUD screenshots.
- Outer padding: 16px.
- Gap between panels: 10px.
- Panel edge: subtle one-pixel dark-green rule.
- Top row: 58% of the usable height.
- Bottom row: remaining usable height.
- Top row columns: overview receives 72%; physical photograph receives 28%.
- Bottom row: three equal-width columns.
- Every panel uses a centered cover crop, matching the original B preview.
- The physical photograph uses a vertically biased crop that keeps the projected
  HUD and its physical reflection visible.
- No added title, logo, label, glow, watermark, caption, or decorative overlay.

## Output and README integration

- Create: `docs/design/sandevistan-g2-showcase.png`
- Preserve: `docs/design/selected-peripheral-focus.png`
- Replace only the README hero image reference and its alt text.
- Keep the composite reasonably compressed without introducing visible HUD text
  artifacts.
- Add `.superpowers/` to `.gitignore`; browser-companion previews are local
  design artifacts, not repository content.

## Validation

- Confirm the output is exactly 1920×1200.
- Inspect the final image at original resolution.
- Verify all five sources are represented in their approved positions.
- Verify the overview remains the dominant panel.
- Verify the physical photograph clearly proves real G2 output.
- Verify the bottom-right panel matches the original B cover crop rather than
  the rejected full-aspect variant.
- Verify no source copy or HUD geometry has been regenerated.
- Confirm the README relative image link resolves.
- Run the repository copy check and `git diff --check`.

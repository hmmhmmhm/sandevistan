# Private build 0.2.5 preparation

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

The owner approved the displayed answer-position design and requested deployment. The
implementation adds the right-edge scrollbar and localized line-position footer. It
preserves the approved body, readiness band, and Back hint. Position counts use the rows
actually retained after speaker-block cropping. Streaming growth updates the total
without moving a pinned reading position. The scrollbar reaches the bottom at the last
row. Korean/Japanese labels and an English fallback match existing small HUD copy
conventions.

Native simulator verification with real OpenAI passed three consecutive held questions
on one connection, including Ansan weather and its umbrella follow-up. All 18 rapid
native scroll inputs applied; 16 overlapped busy transport work. Actual canvas captures
include rapid-scroll-up-canvas.png and umbrella-final-answer-canvas.png under
output/ask-ai-weather-2026-11-08/. Comparison with the approved
output/ask-ai-position-design-2026-11-08/position.png confirms the footer and track
occupy their intended regions. Neither overlaps the Back hint or body. The source
fixture differs from the reference's long solar-power answer. Therefore, its content and
number of rows differ. Layout/range behavior also has an automated renderer check for
top, middle, bottom, and streaming while pinned.

Validation: 102 Vitest files / 769 tests passed. Both TypeScript configurations,
repository checks, whitespace checks, and EvenHub packaging passed. The prior 637 Node
tests passed after the functional changes. This iteration changes only image rendering,
its locale helper, preview/test code, and manifest version. The production build reports
its existing large-chunk warning. A scan of the built client files supplied to the
official packer found no exposed project-key prefixes. The EHPK is not a ZIP archive.
The release record gives the artifact size and SHA-256 separately.

Release artifact and exact proposed changelog are recorded in
../releases/2026-11-09-private-build-025.json. The owner explicitly approved that exact
final text. Build 0.2.5 was uploaded and verified as Private in Even Hub, including the
exact changelog. Evidence is output/release-025-2026-11-09/evenhub-confirmed.txt. The
task browser session was closed and the session inventory was empty. Physical G2 testing
remains outstanding.

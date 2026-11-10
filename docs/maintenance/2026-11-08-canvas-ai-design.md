# AI detail screens on the existing image HUD

Status: revision-02 visuals explicitly approved by the owner on 2026-11-08
("Yes, that looks good; use this layout and build it"). Implementation and
verification are now authorized. Design previews used example text; final
live results are recorded separately.

The owner requested replacing the plain native Text AI screens with the same
four-image pipeline as the other HUD screens. This supersedes the previous
native-text requirement for the production fast HUD.

Use the existing monochrome 576 x 288 Canvas and 288 x 144 tiles, preserving
IDs 3/5/2/4, the configured send concurrency, palette, and unchanged-payload
skipping. Render one continuous surface; tile edges are transport boundaries,
not separate reading columns. Keep the dashboard/map design intact.

Ask AI uses a small localized header/status and open-corner conversation
blocks. Speaker labels are separate from 18 px text. Keep latest-line following
and one-line history navigation, the configured grapheme pacing, tap flush or
cancel, MCP approval, and double-tap exit. Wrap transcript lines conservatively
for Canvas text width. Await image completion before the next paced update.

Conversate uses a compact status header, an automatic Inform region, readable
caption/translation text, and a compact Copilot region. Wrap actual text by
measured width; retain explicit errors and key-required states. Preserve
existing timeout/dismissal, optional features, history and suggestion controls.

Remove native-text entry/update/restore from the production HUD controller.
Entering or exiting either feature redraws the existing image page. Refresh
all four tile candidates for AI screens, allowing unchanged tiles to be skipped;
keep background weather/map updates from triggering AI-detail redraws.
Transport remains queue-free and busy-drop; no page-rebuild timers or image
retries are added. Acknowledged AI presentation and input-triggered redraws
share the established transport.

Verification: regression tests for image input flow, awaited refresh, content
wrapping, approvals, errors, caption/translation/Inform/Copilot visibility;
actual simulator image transfer and captures; live synthetic voice using the
production runtime; typechecks, full tests and packaging. Simulator rendering
does not establish physical G2 image latency or bilateral delivery.

## Revision 02 — approved

The owner requested approximately four Inform lines and smaller typography.
The preview now allows four Inform lines at 15 px / 18 px line height,
Ask AI body at 18 px, Conversate captions at 17 px, translations and reply
suggestions at 16 px, and smaller 9–12 px labels/status/meaning text.
The sample Inform deliberately spans four lines to show the capacity while
preserving caption, translation, and reply-preview space. Images are in
`output/canvas-ai-design-2026-11-08/revision-02/`. The owner approved this design. Preview images alone are not live AI or
hardware validation.


## Implementation verification

The implementation uses the approved revision-02 dimensions and typography.
Translation, Inform and Copilot settings are passed to the image renderer;
disabled auxiliary content is hidden even when it exists in session history.
Missing-key messages are localized, and connecting does not falsely display
a listening microphone. The [final implementation report](2026-11-08-canvas-ai-implementation.md)
contains live network results, actual screen captures and consolidated checks.

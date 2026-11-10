# Approved AI image HUD implementation

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

The owner approved the [revision-02 design](2026-11-08-canvas-ai-design.md). The approved layout is now connected to the
production fast HUD on `main`. All work remains local and uncommitted. No GitHub
publication was performed.

## Result

Ask AI and Conversate now remain on the existing 576 x 288 Canvas image page. The
surface is split into four 288 x 144 tiles with the established IDs and full-frame order
3/5/2/4. For AI detail views, the controller checks all four tiles. It skips unchanged
payloads. The configured four-call transport is retained. No native Text upgrades or
native-page restoration delays are used by the production AI controller.

The approved typography is unchanged. Ask AI body text uses 18 px. Conversate captions
use 17 px. Translation and reply text use 16 px. Inform uses 15 px with up to four
lines. Labels, status, and meaning use compact 9–12 px type. Inform leaves space for
captions, translation and reply suggestions. Connecting and missing-key states are
explicit and localized. Disabled auxiliary settings hide retained content.

Ask AI retains automatic newest-line following, manually pinned history, configured
grapheme pacing, tap flush/cancel, MCP approval and double-tap exit. The refresh request
exposes its completion promise. Each paced frame can therefore wait for image
acknowledgements. Entry/exit and Conversate input changes redraw the existing image
page. Background map/weather/news updates do not redraw AI detail screens. No image
retries or image-payload queues were added.

Long answers show the most recent visible transcript rows. Earlier parts of questions
and replies remain available through history scrolling. Image transfer time adds to the
configured per-grapheme delay. A physical G2 test is still required to assess
readability, latency, bilateral delivery and load.

## Verification evidence

Evidence is in `output/canvas-ai-implementation-2026-11-08/`:

- `approved-ai-screens.png`: actual final Ask AI voice result plus the approved four-line Conversate
  layout fixture. This is a labeled arrangement of real simulator frames, not an
  image-generation mockup.
- `pass*-raw/visible` captures and associated JSON: actual voice-session frames (raw filenames
  are `pass*.png`, readable derivatives end in `-visible.png`).
- `states/`: 12 deterministic screen cases, including thinking, long answers, history,
  approval, errors, Inform, translation and Copilot. These examples test layout, without
  claiming new AI-generated Conversate output.
- `conversate-input/results.json`: nine actual simulator-input checks using the production Conversate
  runtime, input controller and image transport with a deterministic session. The checks
  covered dismissal, Copilot open and next, Inform history, history selection, timed
  hide, and dashboard return. The fixture's hide timer is three seconds. The product
  default remains ten seconds.
- `production-route/`: real `/hud-canvas-fast` entry/exit checks, localized missing-key states,
  hide/restore, final console capture and screenshots.
- `result.json`: actual OpenAI voice-session checks, protocol timeline, model IDs,
  automatic-follow state and recorded image operations.

Raw simulator PNGs encode coverage in alpha over a green RGB plane. Readable images
composite that alpha over black. All test speech was AI-generated and injected at the
SDK's 16 kHz PCM boundary. No physical microphone was recorded. The existing key was
passed only through non-echoed stdin and a strict-origin one-shot local relay, then
cleared. No credential was persisted in artifacts.

### Live OpenAI checks

`verify-assistant-live.mjs --image` and `tests/simulator/assistant-image.html` exercised the production AI runtime, normal presentation
pacer, view synchronization, encoder and image transport inside the simulator WebView.
The same synthetic samples as the earlier voice audit were reused, including six seconds
of trailing silence for semantic VAD.

All four questions completed across three session connections:

- English introduction retained the name Alex.
- A follow-up returned Alex, preserving conversation context.
- Two independently reconnected Korean arithmetic questions returned 2.
- An idle observation produced no unsolicited response.
- Exit during startup returned false and left microphone ownership off.

Instrumentation recorded image IDs 2/3/4/5, zero native Text upgrades, zero page
rebuilds during the voice fixture, automatic latest-line following, and
microphone/listener cleanup. The first English question received an English reply
despite a Korean UI. The test does not establish universal reply-language compliance. It
does not fix the earlier synthetic Korean proper-name recognition limit.

### Consolidated software checks

- 92 Vitest files / 719 tests passed.
- 627 Node tests passed.
- 17 Sites/API tests passed (overlapping the Node suite).
- Production and simulator typechecks passed, including the final input fixture.
- Repository checks and `git diff --check` passed.
- Build and EHPK packaging passed: 2,191,611 bytes, SDK 0.0.16, minimum Even App 2.2.10.
- `npm audit`: zero vulnerabilities.

There were no uncaught/unhandled JavaScript errors in the screen/input fixtures or the
production-route journey. One existing RSS source again returned an upstream 502. During
simulator process shutdown, the production app's best-effort sensor stop also logged an
AudioControl no-container error after page destruction. Neither observation is
represented as successful physical-device or microphone verification.

All simulator, Vite and credential-relay processes were stopped. Physical G2
microphones, BLE/background behavior, battery impact, long noisy conversations and
bilateral image timing remain hardware checks.

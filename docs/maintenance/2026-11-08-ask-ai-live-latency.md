# Live OpenAI Ask AI latency and exit verification

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

The owner explicitly requested real OpenAI sessions with TTS audio and exit during
generation. The previously authorized key was reused in memory through stdin, with no
key in arguments, bundles or test records. No new key was created.

## Method

The verifier generated three fresh Korean TTS samples through OpenAI Realtime using the
account-available `gpt-realtime-2.1-mini` alias. It then used the actual production model resolver
and `gpt-realtime-2.1` Ask AI sessions. The samples were 24kHz PCM, resampled to 16kHz SDK
AudioEvent input. The production session converts them back to the OpenAI input format.
Six seconds of silent frames followed. No physical microphone was recorded or opened.
Microphone bridge acknowledgements were simulated. Audio subscription/session ownership,
API requests, WebSocket traffic, Canvas images and simulator double-tap events were
real.

Timing starts when the verifier submits the 100ms PCM chunk containing the last sample
above the voiced threshold. Source granularity is approximately 100ms. First and final
display timings end when the SDK acknowledges an image frame containing received text.
This is not a physical G2 display/ BLE latency claim. The native simulator and local
Vite server were launched for one page, then closed before any browser evidence review.
All operations were sequential.

`benchmark-checklist` was used to inspect measurement endpoints, errors, correctness and whether
real work occurred. This is a small end-to-end check, not a statistically established
speedup or an estimate of all user conditions. Host load at start was 4.12/5.90/6.85 on
8 logical CPUs. No CPU profiler was run.

## Observed results

Each question was run twice, once before and once after the activity-label fix. Original
run data is preserved in `output/ask-ai-live-2026-11-08/run-01/`. The final run is `output/ask-ai-live-2026-11-08/result.json`.

| Question | First text, original | First text, final | Complete, final |
| --- | --- | --- | --- |
| One plus one, answer digits only | 2.430s | 2.362s | 2.362s |
| Why the sky is blue, three sentences | 2.870s | 2.529s | 3.278s |
| Twenty numbered solar-power pros/cons | 4.315s | 3.865s | Exited during generation |

The final responses were semantically correct for the two completed questions. The
explanation's first visible batch contained 31 characters, rather than a one-grapheme
backlog. Server-first-text to first image acknowledgement was 0.217–0.238s in the final
pass. Initial connection readiness took 2.661–4.112s. Measurements vary by prompt. Each
question has only two observations.

Both live exit trials occurred while a response ID was active, before response.done.
Final-pass double-tap to dashboard image acknowledgement was 0.021s in the simulator.
The runtime issued socket-close and microphone-close calls in the same millisecond as
exit handling. The WebSocket subsequently reached CLOSED. The runtime removed the audio
subscription, and the dashboard remained selected. There were zero active image calls at
the live click instant. This trial verifies exit during actual generation. The separate
two-second fault-injection run in `2026-11-08-ask-ai-usability.md` covers exit during a busy image call.

The image path peaked at four in-flight calls, with zero native Text updates or page
rebuilds. No uncaught/fetch errors were recorded in the original run. Final console and
key-pattern checks are retained with the evidence. Keys were removed from memory when
the verifier exited.

## Issue found and fixed

The first live capture showed that the dashboard could retain a thinking label after the
socket closed. The input handler drew the dashboard before asynchronous persistence
published an idle snapshot. The image busy gate could drop that later refresh. A failing
regression demonstrated snapshot.phase remained thinking synchronously after stop.

`ai-runtime.ts` now publishes an inactive snapshot immediately on stop, before waiting for
microphone/storage completion. The protocol data remains available for persistence. The
final live pass verified dashboardIndicatorIdle=true. The input and display layout and
existing session cancellation rules are unchanged.

The first-run long-answer screenshot was taken after the double-tap because capture
awaited 120ms while the exit signal was sent immediately. The screenshot remains
diagnostic evidence. It is not used as a pre-exit image. The final harness waits for the
real first-answer capture before dispatching the touch event. Its image shows the actual
partial solar-power answer before the dashboard capture.

## Artifacts and release

- `output/ask-ai-live-2026-11-08/measurements.json`: final derived timings.
- `result.json`, `console.json`, per-state JSON/PNG, synthetic PCM/text: source evidence.
- `review-final.png`: unchanged simulator PNGs rendered on black for readability.
- `scripts/verify-ask-ai-live.mjs` and `tests/simulator/ask-ai-live.ts`: rerunnable verifier.
- Regression: 94 Vitest files / 730 tests, simulator TypeScript, repo checks and pack
  passed.
- Version 0.2.2 fixes the stale activity label. The owner approved its exact new change
  log before submission. Even Hub Build details verified 0.2.2 as Private with the
  unchanged approved text. The 0.2.1 approval was not reused. The working browser was
  stopped. The final session inventory is empty.

Physical G2 microphone capture, ambient noise, BLE behavior and visible-display latency
remain outside this simulator run. Routing/map/news were not part of this focused
verification. No GitHub branch or push was made. Work stays on main.

# Session clocks and dual Ask AI transcription

## Implemented behavior

Both AI headers show elapsed microphone ownership and the current local HH:mm. A monotonic clock counts silence, transcription, and answer waits after microphone activation. The timer is unset while connecting, refreshes every second, and resets on exit. It does not imply an audio recording is stored. Ask AI retains its large readiness band. Conversate uses the same prominent initial readiness until the first caption, then restores the primary transcript, translation, Inform and Copilot layout.

Ask AI now sends identical PCM to a gpt-live-transcribe caption session and its existing gpt-transcribe refinement in the Realtime conversation session. The latter's semantic VAD commit event commits the caption session as well. Only final refinement creates the replacement text input and answer; provisional captions cannot answer or overwrite a finalized or newer turn. Both configurations must be acknowledged before microphone activation. Both sockets close on exit. A live-caption failure terminates the session with an explicit error. Secondary transcription without a verified tariff is marked unpriced in the local estimate.

The owner's request supersedes the older single-model production policy. This is two transcription models plus the existing answer model, not two simultaneous answer generators. No forced input-language setting or primary-language translation is used in transcription.

## Verification

The authorized key was used only in memory. Cached real OpenAI TTS was replayed as SDK PCM events at normal playback rate. Microphone acknowledgements were simulated; physical G2 capture, noise robustness, and physical display appearance remain unverified.

Ask AI live checks passed: Korean calculation, English scheduling, mixed Korean/English, and exit during a long generated answer. Every case acknowledged gpt-live-transcribe and gpt-transcribe. The first three had 15/20/28 live caption deltas and exact equality between the final displayed transcript and the input sent for answering. They preserved Tuesday at three, Thursday at ten, and 110%. First displayed answer after measured speech end: approximately 2.60, 3.67, and 3.11 seconds. Initial connection readiness took about 5.0–6.0 seconds because both configurations are awaited. These are individual observations, not latency guarantees or a comparative accuracy benchmark.

During the fourth case a native simulator double-tap occurred while generation was active: socket/microphone closure followed in roughly 1 ms and the dashboard frame committed in about 27 ms. No image transfer was active in this particular exit; the earlier image-busy exit regression remains covered by separate tests. Cleanup stopped microphone ownership and unsubscribed audio.

Conversate live checks passed: 4 complete and translated utterances, 4 Inform entries, 3 reply suggestions, 106 partial-caption display updates, no manual inputs, no wrong partial/previous-translation pairings, no text overflow, and a recording clock advancing to approximately 47 seconds. Numeric and scheduling meaning checks passed.

Evidence: output/ask-ai-dual-2026-11-08/result.json and output/conversate-live-2026-11-08/result.json. Canvas PNGs are actual source frames before the SDK image transport. Native simulator framebuffer screenshots remain uniformly green and are not evidence of rendered glasses content.

All 744 Vitest tests across 96 files and 637 Node tests passed. App/simulator typechecks, repository rules and Even Hub packaging passed. Artifact and built-content credential scans found no key patterns. Version 0.2.3 is prepared; publication requires approval of the exact changelog in docs/releases/2026-11-08-private-build-023.json. No branch, commit, push, Worker deployment, or Hub upload was performed in this follow-up.

Reference: https://developers.openai.com/api/docs/guides/realtime-transcription

## Publication

The owner approved the exact prepared changelog with an explicit instruction to deploy. Version 0.2.3 was uploaded to the existing SANDEVISTAN project as Private. The build list and Build details confirmed version, visibility, package size and exact changelog. The task browser session was stopped and no sessions remained. See the release JSON and evenhub-023-confirmed.txt for evidence.

# Conversate and Ask AI live follow-up

## Changes

- Stop learning a new Conversate noise floor while speech is active. The old detector treated speech fricatives as hiss and prematurely committed at 1.1 seconds, dropping roughly two seconds of the schedule sample before both transcription models received it.
- Wait for both transcription configuration acknowledgements before enabling the microphone.
- Translate every completed segment in order, independently of optional Inform/Copilot analysis. Discard obsolete refined-text results and hide an earlier translation while a newer partial caption is visible.
- Give analysis an explicit currentUtterance and previousContext JSON envelope. The previous prompt sometimes translated the preceding budget sentence instead of the current 110% statement.
- Leave Ask AI thinking state when output text ends, while keeping responseComplete false until the actual terminal event. Keep received answers visible after a later error. Empty transcriptions without an active response return to listening.
- Use the human-conversation transcription guidance in Ask AI as well as Conversate. Production model selection remains unchanged.

## Evidence

Real OpenAI sessions used the previously authorized key in memory only. Four cached synthetic PCM inputs were injected through SDK AudioEvent at normal playback speed, without touch or scroll. Microphone acknowledgements were simulated; this was not a physical G2 microphone test.

Latest Conversate result: 4 completed segments, 4 translations, 79 partial-caption display updates, 4 Inform history entries, 3 reply suggestions, zero manual inputs, zero old-translation/new-partial pairings, no canvas text overflow. Tuesday at three, Thursday at ten, budget deadline, and 110% survived transcription and translation. Both final runs passed these checks. Earlier failures remain in run-01, run-02 and run-03 evidence folders.

Artifacts: output/conversate-live-2026-11-08/result.json and all-features-canvas.png. Native simulator glasses screenshots were uniform green and are NOT evidence of rendered content. The canvas PNG is the actual application source frame before SDK transport; transmission completion and draw records were separately logged. Physical display appearance remains unverified.

Ask AI used the same English and mixed Korean/English audio against gpt-transcribe and gpt-live-transcribe. All four comparisons preserved the tested dates, times and percentages. This small clean-speech comparison does not establish superiority in noise or with proper nouns. A fifth real-answer test deliberately suppressed response.done: after 21 seconds the answer remained visible, phase was listening, and responseComplete remained false.

Verification: 94 Vitest files / 737 tests, 637 Node tests, app and simulator typechecks, repository rules, and Even Hub packaging passed. The package retains version 0.2.2 for local verification only and was not uploaded as a replacement release.

## Pending at the time of this audit

The next owner-requested change is recorded in [session clocks and dual transcription](2026-11-08-ai-clocks-dual-transcription.md). That follow-up implements the initial readiness and prepares version 0.2.3.

The initial-only large Conversate readiness design has been shown for approval but has not been implemented. Existing private Hub build 0.2.2 does not include this follow-up. A new release requires a new version and approval of its final publication text. Real microphone/noise testing and native framebuffer validation remain outstanding.

Reference: https://developers.openai.com/api/reference/resources/realtime/server-events and https://developers.openai.com/api/docs/guides/realtime-transcription

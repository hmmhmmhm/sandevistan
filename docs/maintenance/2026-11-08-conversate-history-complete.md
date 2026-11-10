# Approved Conversate history and hold-to-speak release

The owner approved the displayed fixed-region design and click/scroll interaction on 2026-11-08. The production Conversate renderer now keeps four transcript rows at fixed coordinates while Inform and Copilot appear, update or expire. Source and translation rows accumulate across retained turns. Each scroll moves one wrapped row; a stable row key pins older content during incoming speech and translation. At the live tail, a very long translation cannot displace all of the latest source text.

Both automatic cue types show a whole-second countdown using the existing configurable duration, default 10 seconds. Expiry hides the live card and preserves the record. A click opens the chronological auxiliary directory; scroll selects an entry, click opens it, and another click returns to live mode. Historical Inform does not acquire a new expiry, and historical Copilot supports its alternative replies. Captions remain active and visible while history is open. Current sessions retain up to 200 transcript turns and 20 entries of each cue type. Both cue histories are persisted with the local session record. The phone's existing duration setting is labeled for all AI cues and remains editable when either cue type is enabled.

The earlier clear-Copilot-on-new-speech behavior is removed. An older final transcription cannot clear a newer partial. Optional analysis rejects stale text revisions. Disabled cue types are excluded from the directory. Inform scrolling is bounded to the actual wrapped line count. Stored Copilot records are validated without rejecting older records that do not have the new field.

## Real OpenAI and native input evidence

The memory-only authorized key and task-cached synthetic speech were used through SDK AudioEvent, the production runtime, and the same four-image SDK transport. No physical microphone was recorded. The initial four speech samples required zero touch input. The test then used 16 native simulator click/scroll gestures and two additional speech samples.

The final run passed: 6 completed/translated utterances, 5 Inform records, 5 Copilot records, 136 partial-caption frame updates, both countdowns visibly decreasing, exact one-row backward scrolling, pinned older text during new speech, return to latest, cue expiry without transcript/record deletion, reopening both earlier cue types, Copilot alternative selection, ongoing transcription while an earlier Inform remains open, and persistence of both cue histories. Every captured transcript frame matched the selected wrapped rows and stayed within the canvas. Audio subscription and microphone ownership stopped at cleanup.

Evidence: output/conversate-history-live-2026-11-08/result.json, directory-list-canvas.png, reopened-inform-canvas.png, reopened-copilot-canvas.png, and history-with-live-transcription-canvas.png.

### Framebuffer clarification

Earlier audits described the native glasses screenshot as uniformly green. Pixel inspection shows green RGB with a transparent background and an opacity mask carrying the HUD foreground. A viewer that ignores alpha makes that look solid green; it was not a blank framebuffer. Comparing its nontransparent foreground to the source canvas after the production four-level cutoff gave exact masks for reopened Inform, reopened Copilot, and the expired-cue transcript. The directory mask overlap was 0.998609; all differences were inside the clock digit rectangle x495–501/y9–17. This verifies simulator framebuffer geometry, not physical G2 appearance or optical readability. See framebuffer-comparison.json.

## Ask AI in the same package

The hold-to-speak implementation from the preceding checkpoint is included: closed microphone before hold, visible provisional captions from held PCM, one manual commit on release, final-refinement-grounded response, no automatic speech endpoint, robust release/exit while images are busy, empty-hold discard, and delayed microphone acknowledgement cleanup. The recording clock accumulates held time while the local clock continues in waiting mode.

Three real OpenAI speech cases passed. The combined run's first exit assertion missed a fast completion after waiting for an image; it remains recorded as failed. An isolated native double-tap replay triggered on active response creation passed. Do not describe the original combined result as fully successful. See output/ask-ai-hold-2026-11-08/run-01/result.json and output/ask-ai-hold-exit-2026-11-08/result.json.

## Verification and publication

100 Vitest files / 761 tests passed. All 637 Node tests, application and simulator typechecks, repository rules, diff whitespace check and Even Hub packaging passed. Built output and JSON artifacts contained no key patterns. SDK 0.0.16 and minimum Even App 2.2.10 remain unchanged. No branch, commit, push or Worker deployment was made. No task-owned simulator, Vite server or browser session remains.

Version 0.2.4 is prepared and awaiting approval of its exact release text in docs/releases/2026-11-08-private-build-024.json. Version 0.2.3 remains the published Private Build until the new approval and upload are complete.

## Publication completed

The owner explicitly authorized deployment of the prepared release. Version 0.2.4 was uploaded to the existing SANDEVISTAN project as Private. The build list and Build details confirmed the version, visibility, 2.2 MB package and exact approved changelog. Evidence is evenhub-024-confirmed.txt and the release JSON. The task browser session was stopped and no browser sessions remained.

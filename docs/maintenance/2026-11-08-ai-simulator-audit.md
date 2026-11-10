# AI and simulator maintenance audit

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

Date: 2026-11-08. Branch: `main`. Baseline: `7d68cb9`.

All changes are local. The temporary maintenance branch was removed at the owner's
request. No GitHub publication, app upload, or release was performed.

## Reference contracts

The [Even SDK device guide](https://hub.evenrealities.com/docs/build/device-apis) defines a startup page before glasses microphone capture, PCM16 mono at
16 kHz, and one active input-capturing container. Page creation, native text updates,
and exact container identifiers were checked against the [page lifecycle guide](https://hub.evenrealities.com/docs/build/page-lifecycle).

The [official Conversate guide](https://support.evenrealities.com/hc/en-us/articles/14273795154319-Conversate) was used to compare ongoing transcription, source-to-target translation,
contextual Cues, timed automatic pop-ups, and optional Prep Notes. This work improves
those existing screens and behavior. It does not reproduce Even's proprietary models,
Knowledge Base, Pro Insights, cloud sync, or complete review workflow.

The [official simulator guide](https://hub.evenrealities.com/docs/test/simulator) provides the HTTP input, framebuffer, and console APIs used here.
Simulator 0.9.5 was pinned locally. Only one simulator page and process ran at a time.
Before opening the next page, the verifier terminated the previous process and checked
its exit. No physical microphone was captured. Final work servers and credential
processes were terminated.

## Model selection

Actual account catalog lookup and live calls confirmed:

| Role | Current alias |
| --- | --- |
| Ask AI | `gpt-realtime-2.1` |
| Conversate analysis | `gpt-6-luna` |
| Grounded web search | `gpt-6.1-sol` |
| Live transcription | `gpt-live-transcribe` |
| Final transcription refinement | `gpt-transcribe` |
| Synthetic test speech | `gpt-realtime-2.1-mini` |

Each new AI session queries the available model catalog. Within the compatible Realtime,
Luna, and Sol families, selection compares numeric versions instead of creation
timestamps. Dated snapshots and incompatible API families are not selected merely
because they are newer. Transcription uses undated aliases. Catalog failure uses the
reviewed aliases and is logged. A model name does not guarantee future API or schema
compatibility. This policy does not establish that every future model will work without
a migration.

Sources: [current models](https://developers.openai.com/api/docs/models), [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), and [TTS migration](https://developers.openai.com/api/docs/guides/text-to-speech). At this checkpoint, the
pricing snapshot distinguishes current Realtime and Sol rates from legacy rates. It
marks unknown future-model usage unpriced.

## Reproduced defects and changes

- **Packaged builds required a missing `/api` server.** Conversate and web search
  now reuse the bounded request handlers directly in the WebView, calling OpenAI with
  BYOK. Server endpoints remain available. A real WebView test passed model discovery,
  ephemeral-secret minting, streamed analysis, three reply suggestions, and cited web
  search with no local API dependency.
- **Timeouts ended after response headers.** AI search, Conversate, and token deadlines
  now cover response bodies. Parent cancellation propagates to direct requests. The
  client-secret request also has a ten-second deadline.
- **Stopped sessions could revive or leak audio.** Conversate now rejects late startup,
  transcript, and analysis callbacks. During cleanup, it waits for in-flight microphone
  activation. If the primary socket fails unexpectedly, it closes audio. Ask AI ignores
  events from a socket that no longer owns the session, including delayed close
  notifications after normal stop.
- **Refinement paired unrelated turns by arrival order.** Matching now uses each
  stream's committed item acknowledgements and a local commit identity. Out-of-order
  completions cannot be paired merely by completion order.
- **Mixed-language speech skipped translation.** Analysis now translates foreign spans
  even when the dominant language equals the target language. The prompt requests Inform
  in the user's language. For unclear terms, it requests explicit uncertainty instead of
  invented definitions.
- **Cues disappeared when speech continued.** New partial speech clears old Copilot
  choices while retaining the timed Inform. An Inform for the latest completed turn can
  appear while new partial speech is arriving.
- **Translation waited for all Copilot fields.** Bounded SSE processing publishes
  complete translation/Inform fields before reply generation finishes. Final JSON still
  undergoes full validation.
- **Steady hiss prevented end-of-turn commit.** The VAD accounts for a measured
  high-crossing background floor. The same synthetic noisy fixture that failed to
  finalize now produced a completed transcript and translation. This is a limited DSP
  improvement, not general noise or speaker separation.
- **Dashboard direction contradicted its input contract.** Scroll bottom now advances
  the dashboard, matching detail input and the documented page order. Rollback tests
  were corrected with the direction change.
- **Token-purpose parsing buffered unbounded JSON.** Oversized/invalid bodies are
  rejected before contacting OpenAI. The original no-body Ask AI request retains its
  default purpose.

The earlier SDK, checkbox, RSS hostname, dev-body-limit, and Vite warmup fixes are
recorded in the [initial SDK audit](2026-11-08-sdk-audit.md).

## Live synthetic speech and display evidence

The live verifier read the supplied key from stdin with terminal echo off. It did not
write the key to an env file, app storage, source, package, logs, or artifacts. A
one-shot origin-restricted loopback handoff also allowed the actual simulator WebView to
use it in memory. Neither the secret nor ephemeral client-secret values are included in
results.

TTS generated English, Korean, and mixed Korean/English test speech. The verifier
injected PCM16 mono at 16 kHz in 100 ms SDK audio events. The audio passed through the
production Conversate session, local VAD, resampler, live and refinement sockets,
analysis runtime, and native display content. The simulator rendered snapshots
automatically. There were no conversational taps or scrolls during the audio tests.

| Case | Observed result |
| --- | --- |
| English scheduling/technical question | Transcript, Korean translation, Inform, and reply suggestions |
| Korean technical question | Transcript and Korean Inform; redundant Korean translation omitted |
| Mixed speech without terminology hints | English spans translated after the fix; specialist term recognition remained inaccurate |
| Mixed speech with optional terminology/goal hints | Recognized the revenue-target meaning and translated the English scheduling question; natural pauses split the sample into two turns |
| Quiet English, amplitude scaled to 18% | Completed transcript and Korean translation |
| English with seeded steady hiss | Completed transcript, Korean translation, automatic Inform, and three suggestions after the VAD/streaming changes |
| Ask AI through current Realtime | Two traced runs received speech-start/stop, final transcription, text deltas, and complete Korean answers |
| Actual WebView network checks | Model lookup, secret, streamed translation, Inform, three suggestions, and grounded search passed |

One initial untraced Ask AI attempt did not produce a transcript/answer within its
observation window. Its cause was not established. Two subsequent traced runs completed.
The initial observation does not establish a proven fix or a statistically reliable
connection-success rate.

Artifacts are in `output/simulator-audit-2026-11-08/`:

- `browser-ai-result.json` and `browser-ai-passed.png`: actual WebView results.
- `audio-hints-timeline.json`: automatic transcript/Cue/translation changes, including Cues remaining
  visible during later partial speech.
- `audio-noise-timeline.json`, `baseline-noise-timeline.json`: noisy-turn checks.
- `assistant-live-timeline.json` and `assistant-live-final.png`: traced Ask AI.
- `*-tts-24k.wav`, `audio-noise-*-sdk16k.wav`: AI-generated source and injected audio.
- `final-journey-contact.png`: final production-route visual review.
- `final-journey.json`, `final-console-summary.json`: action/frame evidence and absence of uncaught exceptions or
  unhandled promise rejections.

The production-route journey covered overview, map detail/zoom, news paging, TODO
selection/toggle, weather detail, both unconfigured AI entry paths, return transitions,
hide, and restore. Hide produced an empty framebuffer. Restore returned visible content.
Initial pre-fix journey filenames describe planned actions. Under reversed navigation,
they did not identify the actual pages. For the corrected page sequence, use the
`final-*` set. Raw framebuffers retain RGBA; `*-alpha.png` and contact sheets are
diagnostic visualizations.

## Verification and remaining limits

Final consolidated verification after review passed: 89 Vitest files / 705 tests, 627
Node tests, and 17 Sites/API tests (the latter overlap the Node suite). Both production
and simulator typechecks, repository checks, `git diff --check`, build, and EHPK packaging
passed. The package is 2,190,547 bytes, stamped SDK 0.0.16 / minimum Even App 2.2.10.
`npm audit` reports zero vulnerabilities. All changes remain uncommitted on `main`.
No GitHub publication was performed.

Final review also reproduced and corrected three presentation and boundary regressions.
Incoming speech no longer cancels an existing Inform expiry. Streamed and final Inform
results share a turn identity. A completed response therefore cannot undo dismissal or
expiry. An empty local token POST retains its default assistant purpose. The middleware
rejects malformed or oversized JSON. Regression tests exercise the timer, streamed
dismissal, and the actual local HTTP middleware. Simulator, Vite, and credential relay
processes were stopped after verification. The key was not written to repository files.

Remaining limits:

- Physical G2 bilateral delivery, BLE timing, mobile background/permissions, actual G2
  microphones, R1, and wearing/battery events need hardware. The simulator does not
  validate LZ4 transfer. The existing four-call hardware contract remains unchanged
  despite the documentation's sequential send recommendation at this checkpoint. Do not
  interpret simulated rendering as hardware approval.
- Synthetic samples do not establish accuracy for accents, overlapping speech, wind,
  cafe babble, music, or long conversations. Terminology without context remains a
  demonstrated recognition limit. No universal WER or latency claim is made from this
  small test set.
- External MCP servers were not configured for live tool calls. Fixtures and unit tests
  cover approval presentation and protocol behavior.
- One built-in RSS source returned an upstream error during simulator startup. Other
  sources populated the news reader. The unchanged 540-feed catalog was not revalidated
  live in full.
- The initial JS chunk still triggers Vite's size warning. Node 25 also emits a jsdom
  localStorage warning. A supported LTS run remains an environment gate.

# Ask AI voice conversation: focused verification

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

All changes are local on `main`. No commit, push, or external publication was
performed. This follows the broader [SDK/AI audit](2026-11-08-ai-simulator-audit.md).

## What the screenshots show

[Four actual simulator captures](../../output/assistant-audit-2026-11-08/ask-ai-screens.png) show listening, the first reply, a follow-up recalling the user's name, and
a Korean question after reconnection. These are native SDK Text-container screens from
the production Ask AI runtime and its normal 200 ms grapheme presentation. They are not
UI mockups. The contact sheet only labels and arranges captures. Visible versions
composite the raw framebuffer's alpha channel over black because its RGB plane is
uniformly green.

The dedicated fixture injects AI-generated PCM through the production SDK AudioEvent
boundary, replacing physical microphone capture. It uses real OpenAI
requests/WebSockets, the real runtime/pacer, and the real native SDK renderer in the
simulator WebView. Storage is isolated in memory. No API key was persisted in the
fixture, repository, screenshot, or result files.

## Problems found and changes

### Correct captions did not imply correct answers

The baseline recognized the Korean question "1 + 1" correctly, but the Realtime model
interpreted the original audio as a time/date question. Two runs answered `1257`
and `23`. Tool activity and response events confirmed these were actual model
replies, rather than duplicated display characters. The earlier transport-only success
criterion missed this semantic failure.

Ask AI now keeps semantic VAD but disables automatic response generation. After final
transcription, it inserts a user text item beside the original audio item, deletes that
audio item, then requests the response. The model's user input therefore matches the
glasses caption. Existing conversation and tool context remain available. Completed item
IDs are bounded and deduplicated. Late older transcriptions update their position
without starting a new answer. A dismissed pending turn does not trigger a response.

With the same arithmetic PCM, the first revised run answered `2` twice. The
final run also answered `2` on both independently reconnected sessions.

### Startup could report readiness before settings were accepted

The session now waits for `session.updated` before opening the microphone. An unacknowledged
configuration fails with a bounded timeout instead of showing a ready microphone. Stop
invalidates the runtime's startup and event callbacks, including the period spent
loading settings. Late startup or server events cannot revive a conversation after exit.
Failed transcription and failed generation show an error. They no longer appear as a
completed empty answer.

### The synthetic microphone stopped too early

A later English sample reproduced the no-response symptom: `speech_started` arrived, but
`speech_stopped` and transcription never arrived within the 90-second observation window. The
test had sent only two seconds of silence and then stopped supplying microphone frames
while leaving the session open.

The same sample completed when six seconds of silence continued through the audio
channel. This is consistent with semantic VAD's documented default maximum wait of four
seconds. The verifier now includes six seconds of trailing audio. This explains the
reproduced test condition. The cause of the original untraced attempt from the broader
audit still cannot be proven. Physical microphone streaming continuity remains a
hardware check.

### A newer ASR role was not automatically better

The final refinement model remains the account-selected current `gpt-transcribe` family, and
its chosen ID is passed to session configuration and usage accounting. An explicit
`gpt-live-transcribe` comparison on the same Korean samples worsened the name and follow-up
recognition, so that experiment was rejected for Ask AI. Conversate remains separate.

Korean proper names were misrecognized in these synthetic samples by both models. The
final English-name case tests conversation memory separately from that recognition
limitation. It does not demonstrate that Korean names are fixed.

## Final live results

The final run used `gpt-realtime-2.1` and `gpt-transcribe` in the actual simulator WebView. No taps
were used to obtain the four answers or flush the normal paced presentation.

| Check | Observed result |
| --- | --- |
| English introduction, name Alex | Caption recognized Alex; Korean reply acknowledged Alex |
| Follow-up asking the name | Answer was Alex, preserving the prior turn |
| Korean arithmetic after reconnect | Caption recognized 1 + 1; answer was 2 |
| Two-second idle observation before next speech | No spontaneous response |
| Korean arithmetic after a second reconnect | Answer was 2 |
| Exit during startup | Start returned false; microphone stayed off |
| Each normal stop | Audio listener removed and synthetic microphone closed |

This is a small functional sample, not a measured general success rate.

## Evidence and software verification

The evidence directory is `output/assistant-audit-2026-11-08/`:

- `result.json`: final captions, answers, semantic checks, model IDs, and timeline.
- `ask-ai-screens.png`: four labeled native-screen captures.
- `pass*.png`, `pass*.json`: raw frames and associated visible content/state.
- `*-visible.png`: alpha-composited readable frames.
- `*.pcm`, `*.wav`, `*.txt`: AI-generated source audio and intended source
  text.
- `baseline/`: incorrect raw-audio answers before transcript grounding.
- `first-transcript-input-run/`, `transcribe-model-run/`: intermediate revised runs.
- `live-transcribe-experiment/`: rejected ASR comparison, including failed name recall.
- `two-second-silence-timeout/`: the reproduced missing-endpoint case.

Reproduce with `scripts/verify-assistant-live.mjs` (key via non-echoed stdin), a local Vite server on 4179, and
one simulator on `/tests/simulator/assistant.html` with automation port 9898. The one-shot relay on 9899
accepts only the exact local origin and an explicit verifier header. After each run,
stop the simulator and server. Do not run multiple simulator pages.

Final verification passed: 91 Vitest files / 713 tests, 627 Node tests, and 17 Sites/API
tests (overlapping the Node suite). Both typechecks, repository checks, `git diff --check`,
build, and EHPK packaging passed. The resulting package is 2,190,937 bytes, SDK 0.0.16 /
minimum Even App 2.2.10. All verification, simulator, and credential relay processes
were stopped.

Remaining limits include synthetic Korean name recognition, physical G2
microphones/BLE/background behavior, long conversations, interruptions by another
speaker, and real noisy environments. These were not made reliable by the four final
successful questions.

Official references:

- [Realtime client events](https://developers.openai.com/api/reference/resources/realtime/client-events): session acknowledgement, conversation insertion/deletion, and response
  creation.
- [Semantic VAD](https://developers.openai.com/api/docs/guides/realtime-vad): turn detection and automatic response configuration.
- [OpenAI Agents transport](https://openai.github.io/openai-agents-js/guides/voice-agents/transport/): acknowledgement before microphone audio flows.

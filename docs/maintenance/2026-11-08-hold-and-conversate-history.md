# Hold-to-speak and Conversate history checkpoint

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

## Ask AI implemented and verified

The microphone stays closed after session connection. After both model configurations
are acknowledged, SDK long press starts microphone capture. Release immediately blocks
further PCM. The runtime closes the microphone and manually commits one held audio
buffer. gpt-live-transcribe supplies the visible provisional caption. gpt-transcribe
supplies the final text used for one answer. Semantic VAD is disabled in production hold
mode. The waiting copy requests a long press. Double-tap exit and explicit MCP approval
are preserved.

The microphone lifecycle and hold coordinator handle release before activation,
empty/short holds, expiry without auto-send, repeated press/release, and delayed close
acknowledgement. Both hold edges bypass the image busy gate. Recording elapsed time
accumulates held microphone time. The local clock continues between holds.

Real OpenAI tests used this task's previously authorized TTS PCM through SDK AudioEvent.
Three input cases passed: Korean calculation, English schedule, and mixed
Korean/English. In each case, the microphone was off before press. A live caption
appeared during the hold. Despite about six seconds of trailing silence, no answer began
before release. The final visible text equaled the text submitted for answering. First
answer displays followed release by approximately 2.18, 1.92, and 1.90 seconds in this
run. These are individual simulator observations, not latency guarantees.

The first combined run did not pass its exit assertion. Waiting for the first image
missed a fast generation completion. Its failed result is preserved in
output/ask-ai-hold-2026-11-08/run-01. The isolated native-input exit replay triggered on
response.created and passed. Exit occurred during active generation. The microphone and
socket closed, and the dashboard was idle. Evidence is
output/ask-ai-hold-exit-2026-11-08/result.json. No physical G2 microphone or display
validation is claimed.

The actual production waiting renderer was separately inspected in
output/conversate-history-design-2026-11-08/ask-waiting.png. The first live waiting
capture was taken before its presentation frame, so it still shows preparation and is
not evidence of the final waiting copy.

## Conversate diagnosis

The renderer currently paints only the latest completed segment. A new partial/completed
callback explicitly emptied Copilot suggestions. Inform automatically hides after its
configured duration, and variable auxiliary heights change the space available to
captions. None of these paths uses speaker identity.

An older turn completing late could also clear a newer partial. The updated runtime
clears only the matching partial item. Record retention and active-card visibility are
now separated. Inform and Copilot history each retain up to 20 entries, independently of
automatic card expiry. Local session records include Copilot history. Expired or late
final Inform updates do not restart a hidden card. Neither new speech nor expiry deletes
the transcript. A stable row anchor supports one-row history scrolling while new
speech/translation arrives.

## Pending visual approval

The fixed four-row transcript and auxiliary-directory renderer is a separate preview,
not yet applied to production. See output/conversate-history-design-2026-11-08/live.png
and tests/simulator/conversate-history-preview.html. The owner has been asked to approve
the fixed layout and click/scroll/open/return interaction. At this checkpoint,
production still has the earlier renderer. Do not package or publish this intermediate
state as a completed Conversate fix.

After approval, finish the production renderer and countdown labels. Update the live
fixture's expected card-expiry behavior. Replay OpenAI speech with one-row scrolling and
directory reopening. Keep the primary transcript present throughout directory browsing.
Version 0.2.3 remains the deployed Private Build. No new version or upload was made at
this checkpoint.

Checks: 100 Vitest files / 756 tests passed, app and simulator typechecks passed,
repository checks passed, and the Even Hub client build compiled. All task browser
sessions, Vite servers and simulators were stopped. Credential scans of JSON evidence
and built output reported no key patterns.

Official references: https://www.npmjs.com/package/@evenrealities/even_hub_sdk and https://developers.openai.com/api/docs/guides/realtime-conversations for hold/release and manual commits.
Https://support.evenrealities.com/hc/en-us/articles/14273795154319-Conversate for cue
duration, Cue List and transcript retention. The complete on-glasses directory
navigation was not established from public documentation.

## Subsequent approved completion

The owner approved the visual design and the implementation was completed and verified.
See [the completed audit](2026-11-08-conversate-history-complete.md) for the subsequent state, native-framebuffer alpha clarification, live
gesture evidence, and prepared version 0.2.4. The pending section above records this
earlier checkpoint.

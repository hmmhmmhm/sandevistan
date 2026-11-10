# Hold-to-speak Ask AI and persistent Conversate context

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Ask AI checkpoint

Implement the owner's hold-and-release interaction with SDK long press 9 and release 10 from the glasses or ring.
Do not activate the microphone on session connection.
Send only held PCM to live captions.
Commit the turn once on release.
Only final refinement creates an answer.
Disable semantic VAD in this mode.
Let release and exit bypass image-send busy dropping.
Before configuration completes, reject capture.
Discard empty holds.
Close late microphone activation.
Limit each hold to 120 seconds and send nothing on timeout.
Before capture, show the requested hold prompt.
Keep both ASR models and MCP approval.

Local boundary and microphone-lifecycle tests pass.
Real OpenAI TTS checks passed for Korean calculation, English schedule, and mixed Korean and English.
They confirmed microphone off before hold, live preview while held, no answer before release, and exact final-text input.
The first run's exit check missed active generation because it waited for an image during a fast completion.
Preserve that failed run.
The isolated native-exit replay began on response.created and passed with the microphone off, socket closed, and dashboard committed.
These checks use synthetic SDK input. Physical G2 verification remains separate.

## Conversate diagnosis and proposed interaction

Current rendering shows only the latest segment. New partial/completed callbacks explicitly clear current Copilot suggestions. Inform expires after the existing timer. Inform height and Copilot visibility also change the available transcript space. These application behaviors do not depend on speaker IDs.

Preserve a fixed transcript region, append source/translation rows for all retained turns, follow the last line automatically, and browse exactly one wrapped row per scroll. Auxiliary arrivals and expiry must not change transcript selection or delete its rows. Freeze historical browsing while incoming speech and translation accumulate; zero offset resumes following latest.

Keep bounded Inform and Copilot histories, distinct from active cards. Both live cue types use the existing configurable cue duration, defaulting to 10 seconds. Show whole-second remaining time in both active labels. Expiry only hides a card. A reopened historical card remains until the user leaves it and carries a history label rather than a new countdown.

On one click, open a chronological directory in the auxiliary bottom region.
On scroll, select a previous Inform or Copilot entry.
On click, open the selected entry.
On another click, return to live mode.
Inside an open Copilot card, scroll through its three suggestions.
For Inform, page the existing four-line region.
On double tap, exit the mode.
Keep the primary transcript visible during directory browsing and ongoing audio capture.
Persist both auxiliary types in the local session record.
Do not add server storage or publication.

The owner approved this visual layout and interaction on 2026-11-08 with an explicit instruction to proceed. The production renderer now follows the fixed-region preview under tests/simulator/conversate-history-preview.html.

Reference: https://support.evenrealities.com/hc/en-us/articles/14273795154319-Conversate distinguishes cue duration from retained transcript and Cue List. Do not claim its complete in-feature navigation is publicly documented.

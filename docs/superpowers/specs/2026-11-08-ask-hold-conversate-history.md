# Hold-to-speak Ask AI and persistent Conversate context

## Ask AI checkpoint

Implement the owner's explicit hold/release interaction using SDK long press 9 and release 10 from glasses or ring. Session connection does not activate the microphone. Live captions receive only held PCM; manual turn commit occurs once on release and only final refinement creates an answer. Disable semantic VAD for this mode. Release and exit bypass image-send busy dropping. Reject capture before configuration, discard empty holds, close late microphone activation, and bound a hold to 120 seconds without sending on timeout. Show the requested hold prompt before capture. Keep both ASR models and MCP approval.

Local boundary and microphone lifecycle tests pass. Real OpenAI TTS checks passed for Korean calculation, English schedule and mixed Korean/English: microphone off before hold, live preview while held, no answer before release, and exact final-text input. The first run's exit check missed active generation because it waited for an image during a fast completion; preserve that failed run. The isolated native-exit replay initiated on response.created and passed with microphone off, socket closed and dashboard committed. This is synthetic SDK input, not physical G2 verification.

## Conversate diagnosis and proposed interaction

Current rendering shows only the latest segment. New partial/completed callbacks explicitly clear current Copilot suggestions. Inform expires after the existing timer. Inform height and Copilot visibility also change the available transcript space. These application behaviors do not depend on speaker IDs.

Preserve a fixed transcript region, append source/translation rows for all retained turns, follow the last line automatically, and browse exactly one wrapped row per scroll. Auxiliary arrivals and expiry must not change transcript selection or delete its rows. Freeze historical browsing while incoming speech and translation accumulate; zero offset resumes following latest.

Keep bounded Inform and Copilot histories, distinct from active cards. Both live cue types use the existing configurable cue duration, defaulting to 10 seconds. Show whole-second remaining time in both active labels. Expiry only hides a card. A reopened historical card remains until the user leaves it and carries a history label rather than a new countdown.

One click opens a chronological directory in the auxiliary bottom region; scroll selects a previous Inform/Copilot entry, click opens it, and click again returns to live mode. Scroll in an opened Copilot browses its three suggestions; Inform can page its existing four-line region. Double tap still exits the mode. The primary transcript remains visible during directory browsing and ongoing audio capture. Persist both auxiliary types with the local session record. No server storage or publication is involved.

The owner approved this visual layout and interaction on 2026-11-08 with an explicit instruction to proceed. The production renderer now follows the fixed-region preview under tests/simulator/conversate-history-preview.html.

Reference: https://support.evenrealities.com/hc/en-us/articles/14273795154319-Conversate distinguishes cue duration from retained transcript and Cue List. Do not claim its complete in-feature navigation is publicly documented.

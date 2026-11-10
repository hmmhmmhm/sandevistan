# AI guide

AI is optional. Enter your own paid OpenAI API key in the phone companion.
If no key exists, the glasses direct you to the phone settings and the provider's key page.
Opening an AI dashboard page alone does not start the microphone or an API session.

## Use Ask AI

1. Tap the Ask AI dashboard page.
2. Wait for the ready state.
3. Hold the ring or glasses control to start speech capture.
4. Read the provisional caption as you speak.
5. Release the control to stop capture and send the utterance.
6. Read the answer. Scroll to read earlier or later lines.
7. Double tap to exit the session.

The header shows readiness, recorded time and local time.
The recording clock counts held microphone time. It excludes connection setup and idle time.
A position indicator shows the visible answer lines and the remaining content.

Ask AI uses two transcription models on the same held audio.
One model supplies provisional captions. The other refines the final caption.
Only the final caption creates an answer. The app discards empty holds.
A hold timeout discards capture rather than sending an unfinished utterance.

Received answer text appears in batches. Manual scroll keeps the selected reading position.
Tap to return to the latest line and interrupt active generation.
The app stops microphone and session ownership when you exit, including during an image transfer.
A completed response does not require cancellation before the next request.

## Use Conversate

1. Configure Translation, Inform, Copilot and Prep Note in the phone settings.
2. Open Conversate.
3. Wait for the listening state.
4. Speak with the other participant.
5. Read captions, paired translations and automatic cues.
6. Double tap to exit.

Captions remain the primary display. Translation and cues do not replace the transcript.
Scroll moves by a wrapped caption line. Returning to the latest line resumes automatic following.

Inform and Copilot show countdowns while their live cards are visible.
Expiry hides a card but retains its bounded local history.
Tap to open the cue directory. Scroll to select a cue. Tap to reopen the selected cue.
Historical cards do not expire automatically.

Translation stays with its source utterance.
Cue analysis uses recent context, the latest correction and the saved goal when available.
An empty Prep Note is inactive. Prep Note requires Inform to be enabled.

## Tools and model selection

Built-in tools provide time, location, named-city weather and bounded web search.
The session checks the account's model catalog for compatible role aliases.
It does not select an unrelated API because a model has a newer timestamp.
See the [model policy implementation](../../server/openai-auth.js) for default aliases and selection rules.

Custom MCP connections are disabled in public packages because their origins are not fixed.
Development builds can configure bounded HTTPS MCP servers.
Every MCP tool call requires explicit approval on the glasses.

## Keys, history and cost

The Even local-storage bridge stores keys and local history.
Realtime client-secret requests, web search and Conversate analysis call OpenAI directly.
The app does not bundle or log the key.
Conversation excerpts, citations and cue records remain local to the device.

The phone shows local usage estimates for the week and month.
These estimates are not OpenAI billing records. Some secondary transcription usage can be unpriced.
Use the provider account to check actual charges.

## Verification limits

Synthetic TTS input and simulator tests exercise the real runtime and OpenAI requests.
They do not prove physical microphone quality, radio behavior or current-SDK bilateral output.
See the [dated AI audit](../maintenance/2026-11-08-ai-simulator-audit.md) and
[caption and answer investigation](../maintenance/2026-11-08-ask-ai-focus.md).

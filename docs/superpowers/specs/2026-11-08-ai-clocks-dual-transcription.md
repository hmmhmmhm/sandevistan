# Session clocks and dual Ask AI transcription

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

The owner requested matching elapsed recording and local time in the two AI headers, and explicitly requested the Conversate two-model approach for Ask AI.

Both headers show a recording indicator, elapsed microphone-session duration, and current local HH:mm.
Start elapsed time after successful microphone activation.
Include silence and answer generation while the session retains the microphone.
Exclude connecting time.
On exit, stop and reset the clocks.
Update once per second without queuing images.
Keep prominent Ask AI readiness separate from the compact header.
Initially, Conversate shows the previously proposed prominent readiness band.
After speech begins, return to the approved transcript layout.

Keep the existing gpt-transcribe final caption and semantic VAD in the Ask AI conversation socket.
Add a gpt-live-transcribe socket that receives the same PCM and commit boundaries.
Treat streaming captions as provisional.
Only the final refinement can create the text conversation input and one response.
Match turns by committed item identifiers.
Reject late provisional overwrites.
Before opening the microphone, require configuration acknowledgement from both sockets.
On exit, dispose both sockets and callbacks.
Report secondary failures clearly. Do not claim dual-model operation silently.

Verify turn alignment, delayed final results, cancellation, startup acknowledgement, cleanup, clock timing, and layout locally, then replay cached authorized TTS against real OpenAI. Distinguish application source canvas from the simulator's defective native framebuffer capture. Preserve main, existing changes, four-image transport, local BYOK, and explicit publication approval.

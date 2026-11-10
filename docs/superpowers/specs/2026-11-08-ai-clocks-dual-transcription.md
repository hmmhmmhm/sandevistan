# Session clocks and dual Ask AI transcription

The owner requested matching elapsed recording and local time in the two AI headers, and explicitly requested the Conversate two-model approach for Ask AI.

Both headers show a recording indicator, elapsed microphone session duration, and current local HH:mm. Count from successful microphone activation, including silence and answer generation while the microphone remains owned. Connecting time is excluded. Stop and reset on exit; update once per second without queuing images. Keep prominent Ask AI readiness separate from the compact header. Conversate initially shows the previously proposed prominent readiness band, then returns to the approved transcript layout after speech begins.

Ask AI retains its existing gpt-transcribe final caption and semantic VAD in the conversation socket. Add a gpt-live-transcribe transcription socket receiving the same PCM and commit boundaries. Streaming captions are provisional. Only the final refinement can create the text conversation input and one response. Match turns by committed item identifiers and reject late provisional overwrites. Require acknowledgement of both socket configurations before opening the microphone. Dispose both sockets and callbacks on exit. Surface secondary failures clearly rather than silently claiming dual-model operation.

Verify turn alignment, delayed final results, cancellation, startup acknowledgement, cleanup, clock timing, and layout locally, then replay cached authorized TTS against real OpenAI. Distinguish application source canvas from the simulator's defective native framebuffer capture. Preserve main, existing changes, four-image transport, local BYOK, and explicit publication approval.

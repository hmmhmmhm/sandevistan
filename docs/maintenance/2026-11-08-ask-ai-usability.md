# Ask AI usability follow-up

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

The owner could not read the readiness state or return while answers were slow. Thinking
could continue indefinitely. The owner selected displayed readiness option 2:
`../../output/ask-ai-readiness-design-2026-11-08/option-2.png`.

## Reproduction and fixes

Four new regression cases failed before their fixes. They covered a missing large
status, exit waiting for cleanup, dropped double-taps during image transmission, and
post-speech thinking without a deadline.

The selected status band now has a 28px activity title, 16px readiness hint and 12px
back instruction. It distinguishes connecting, microphone-ready, thinking, answering and
error. The existing 18px dialogue sits below the band. Older rows remain available
through history scrolling. MCP approval remains on its existing separate approval
layout. Missing keys never display a ready microphone state.

Production Ask AI now presents all received text at the next presentation tick instead
of one grapheme per tick. Its authoritative protocol and history remain unthrottled.
Ongoing frames still await image acknowledgement. The underlying configurable pacer
retains its historical slow-mode unit coverage.

Double-tap detail exit is handled before the image busy gate. The runtime immediately
ends session ownership, invalidates callbacks, and starts network teardown. Microphone
acknowledgements and storage do not hold the dashboard input result. After the active
transfer, one dirty-state flag requests a fresh rendering of the current Canvas. The
runtime adds no encoded payload queue, retry, or concurrent replacement transfer. An
already active SDK image call must finish or hit its existing 12-second transport
timeout before the dashboard pixels can be sent. Ordinary busy navigation is unchanged.

If no user, assistant, or tool progress occurs for 20 seconds, a response watchdog ends
the session. Continuous progress has a 90-second ceiling. Stop, new speech, completion,
or error clears the watchdog. Explicit MCP approval time is excluded. On expiry the
session closes and shows an error. It does not guarantee an upstream model's latency or
recover failed BLE transport.

## Verification

- Full regression run: 94 Vitest files, 729 tests; 636 Node tests.
- Simulator TypeScript, repository constraints and package creation passed.
- Later circle/status-label fidelity changes passed targeted renderer tests and a fresh
  TypeScript check and three-case simulator run.
- The check used real four-image SDK transport with synthetic protocol and microphone
  acknowledgements. A two-second image delay allowed logical double-tap exit 33ms after
  the block began. Simulated microphone close followed in 1ms, before the delayed tile.
- A 54-character response appeared in one received-text batch.
- A stalled response reached the error screen and released its socket/microphone.
- No more than four image calls were in flight in those tests.
- These numbers describe a controlled simulator fault injection, not hardware latency.
  No live OpenAI request or physical microphone was used in this pass.

Evidence: `../../output/ask-ai-usability-2026-11-08/result.json`, per-case console JSON, raw SDK screenshot PNGs and `review-final.png`.
Raw simulator PNGs encode coverage in alpha over a green RGB plane. The comparison
browser displays those unchanged PNGs on black. It also shows the selected mock beside
the actual frame.

The verifier launches the native simulator binary directly, waits for its exit and
checks no simulator remains before starting the next case. Earlier wrapper shutdown
checks failed. The verifier was corrected. Those failures do not count as app passes. No
simultaneous browser/simulator task surfaces were used.

Version 0.2.1 was registered and verified as Private after the owner explicitly approved
its exact new change log. The earlier 0.2.0 change log approval was not reused. Build
details show the approved text unchanged. Release size/hash and verification state are
in `../releases/2026-11-08-private-build-021.json`. The working browser, Vite server and every simulator were stopped.
GitHub changes remain local on main, with no new branch or push.

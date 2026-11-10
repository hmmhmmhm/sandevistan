# Ask AI usability follow-up

The owner reported unreadable readiness, indefinite/slow thinking and inability
to return while answers were slow. They selected displayed readiness option 2:
`../../output/ask-ai-readiness-design-2026-11-08/option-2.png`.

## Reproduction and fixes

Four new regression cases failed before their fixes: missing large status,
exit awaiting cleanup, double-tap dropped while image transmission was busy,
and post-speech thinking without a deadline.

The selected status band now has a 28px activity title, 16px readiness hint and
12px back instruction. It distinguishes connecting, microphone-ready, thinking,
answering and error. The existing 18px dialogue sits below the band; older rows
remain available through history scrolling. MCP approval remains on its existing
separate approval layout. Missing keys never display a ready microphone state.

Production Ask AI now presents all received text at the next presentation tick
instead of one grapheme per tick. Its authoritative protocol and history remain
unthrottled; ongoing frames still await image acknowledgement. The underlying
configurable pacer retains its historical slow-mode unit coverage.

Double-tap detail exit is handled before the image busy gate. Session ownership,
callbacks and network teardown begin immediately. Microphone acknowledgements
and storage do not hold the dashboard input result. One dirty-state flag requests
a fresh rendering of the current Canvas after the active transfer, without any
encoded payload queue, retry or concurrent replacement transfer. An already
active SDK image call must finish or hit its existing 12-second transport timeout
before the dashboard pixels can be sent. Ordinary busy navigation is unchanged.

A response watchdog ends 20 seconds without user/assistant/tool progress, with a
90-second ceiling across continuous progress. It is cleared on stop, new speech,
completion and error; explicit MCP approval time is excluded. On expiry the
session closes and shows an error. It does not guarantee an upstream model's
latency or recover failed BLE transport.

## Verification

- Full regression run: 94 Vitest files, 729 tests; 636 Node tests.
- Simulator TypeScript, repository constraints and package creation passed.
- Later circle/status-label fidelity changes passed targeted renderer tests and
  a fresh TypeScript check and three-case simulator run.
- Real four-image SDK transport with synthetic protocol/microphone acknowledgements:
  a two-second image delay allowed logical double-tap exit 33ms after the block
  began; simulated microphone close followed in 1ms, before the delayed tile.
- A 54-character response appeared in one received-text batch.
- A stalled response reached the error screen and released its socket/microphone.
- No more than four image calls were in flight in those tests.
- These numbers describe a controlled simulator fault injection, not hardware
  latency. No live OpenAI request or physical microphone was used in this pass.

Evidence: `../../output/ask-ai-usability-2026-11-08/result.json`, per-case console
JSON, raw SDK screenshot PNGs and `review-final.png`. Raw simulator PNGs encode
coverage in alpha over a green RGB plane; the comparison browser displays those
unchanged PNGs on black. It also shows the selected mock beside the actual frame.

The verifier launches the native simulator binary directly, waits for its exit
and checks no simulator remains before starting the next case. Earlier wrapper
shutdown checks failed and were corrected; those are harness failures, not app
passes. No simultaneous browser/simulator task surfaces were used.

Version 0.2.1 was registered and verified as Private after the owner explicitly
approved its exact new change log. The earlier 0.2.0 change log approval was not
reused. Build details show the approved text unchanged. Release size/hash and
verification state are in `../releases/2026-11-08-private-build-021.json`.
The working browser, Vite server and every simulator were stopped. GitHub
changes remain local on main, with no new branch or push.

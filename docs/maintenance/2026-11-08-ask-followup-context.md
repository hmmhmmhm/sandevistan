# Ask AI follow-up, weather, scrolling, and Conversate context

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

Status: functional changes verified locally on main. Not published. The answer-position
design is an isolated preview awaiting owner approval.

## Findings and changes

- A completed Realtime response retained its identifier. Starting the next hold
  cancelled that completed response, and the resulting `response_cancel_not_active` error closed the
  session. New holds cancel only unfinished generation. Cancellation events have bounded
  client identifiers. The handler consumes only the matching, expected
  no-active-response error. Unrelated errors remain visible. A pending response that
  acquires its identifier after a new hold starts is also cancelled. Regression tests
  cover both paths.
- The old live verifier opened a new connection for each question and missed the
  second-request bug. The follow-up verifier now reuses one connection. Baseline failure
  is retained in `output/ask-ai-followup-2026-11-08/baseline/`. An early post-fix result failed because its per-question
  model metrics did not inherit the session acknowledgement. The verifier was corrected.
  That artifact remains a failure.
- Generic search returned weather information without a usable source and the assistant
  refused the named-city request. A bounded Open-Meteo tool resolves a populated city.
  It returns current modeled weather, provider time, hourly rain probabilities, daily
  forecast, and source URL. Named-city weather does not require GPS. Exact two-character
  Korean geocoding can match mountains, so the city-suffix query is also checked and
  populated-place candidates are preferred.
- Current modeled precipitation in millimeters is distinct from forecast rain
  probability. The first structured live run exposed a model confusing these quantities.
  The tool payload and instructions now separate them. The latest actual answer reported
  4.9 C, zero modeled precipitation, and high forecast rain probability, followed by a
  sensible umbrella recommendation for Ansan.
- Image/encoding work previously dropped ordinary scroll events. While busy, Ask AI and
  Conversate apply every scroll transition. They combine repaint requests into one
  repaint of the latest state. No encoded image queue or retry was introduced. This
  preserves received discrete steps. It does not synthesize post-release motion or infer
  physical gesture velocity.
- Conversate already used recent context, goal, and enabled private Prep Note, but both
  request boundaries truncated context to eight turns. Cue requests now retain 24 turns.
  Translation-only requests retain eight. Request bytes remain bounded at 64 KB.
  Instructions explicitly resolve references, prefer the latest correction, ground
  suggestions in agreed facts and prep constraints, and translate only the current
  utterance. The primary language is named in English as well as by locale code. A real
  run exposed one Chinese Inform under Korean settings. After the language instruction
  changed, all five cases produced Korean Inform and meaning fields.

## Verification

- Native EvenHub simulator, real OpenAI, generated PCM through SDK AudioEvent, one
  connection: calculation, Ansan weather, and contextual umbrella follow-up all passed.
  No cancellation error occurred. `output/ask-ai-weather-2026-11-08/result.json` is the final run; `baseline/` and
  `first-structured-run/` preserve earlier results. The original baseline's weak `ok` check
  did not detect weather refusal. Semantic review rejected that result, and the verifier
  was strengthened.
- Eighteen native scroll inputs (nine up, nine down) were all applied. Sixteen arrived
  while transport work was busy. The verifier introduced a 200 ms image acknowledgement
  delay to exercise overlapping work. This is fault injection, not measured
  physical-device latency. Scroll position returned exactly to its starting line.
- In that single three-question run, first displayed answer text arrived 1.82, 1.77, and
  2.20 seconds after release. This is an observation, not a latency guarantee or
  comparative benchmark. Completion checks wait for the final protocol text to reach the
  presented frame before stopping the session.
- Five serial real Responses API cases tested context. Cases covered NRR reference, SLA
  reference with the same current utterance, corrected schedule, older contract terms,
  and private preparation constraints. The baseline passed four of five cases. After
  correction, all five passed, including primary-language checks and manual review of
  actual replies. Artifacts: `output/conversate-context-2026-11-08/baseline.json` and `verified.json`.
- Vitest full run: 767 passed, one stale built-in tool-count expectation failed after
  adding weather. The updated registration test then passed all 19 tests in that file.
  These results account for all 768 cases. Node: 637 passed. Production and simulator
  typechecks, repository checks, whitespace check, and EvenHub production build passed.
  Build reports the existing large-chunk warning.
- Physical G2 microphone acoustics, hardware gesture delivery, and device network
  restrictions remain unverified. Synthetic microphone acknowledgements and native
  simulator image output are not physical-device approval.

## Design gate

`output/ask-ai-position-design-2026-11-08/position.png` proposes a right-edge scroll track and a footer with rows above, visible
range/total, and rows below. Preview-only code lives under `tests/simulator/ask-ai-position-preview.*`. Production
layout is unchanged. Apply only after explicit approval under AGENTS.md's design rule.
No new release was uploaded.

# Ask AI Tap Interrupt Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED AND INTEGRATED`

Implementation commit: `cf05477` (`feat: interrupt Ask AI responses on tap`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one Ask AI detail tap instantly finish a completed paced answer. For an active answer, cancel generation and reveal the received partial text. Resume listening with 250 ms grapheme pacing.

**Architecture:** Route the tap as an explicit view effect into an `AiRuntime.interrupt()` boundary. Add a best-effort `response.cancel` operation to the Realtime session and an acknowledgement-serialized `flush()` operation to the replace-latest presentation pacer. Do not add a frame queue or restart the microphone session.

**Tech Stack:** TypeScript, Vitest fake timers, OpenAI Realtime WebSocket events, Even Hub native text container.

---

### Task 1: Route the Ask AI detail tap

**Files:**
- Modify: `src/fast-hud-view.ts`
- Modify: `src/fast-hud-view.test.ts`
- Modify: `src/fast-hud-input-controller.ts`
- Modify: `src/fast-hud-input-controller.test.ts`

- [ ] **Step 1: Write failing reducer and controller tests**

Assert that a tap in `mode: "ai"` returns `effect: { type:
"interrupt-ai" }`, that the controller awaits `aiRuntime.interrupt()`, and that
it neither calls `stop()` nor restores the native page.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm test -- src/fast-hud-view.test.ts src/fast-hud-input-controller.test.ts`

Expected: FAIL because `interrupt-ai` and `AiRuntime.interrupt()` do not exist.

- [ ] **Step 3: Add the effect and controller branch**

Extend `FastHudEffect` with `{ readonly type: "interrupt-ai" }`, return it from
the Ask AI tap branch, and handle it before native scrolling/redraw logic:

```ts
if (transition.effect?.type === "interrupt-ai") {
  await aiRuntime?.interrupt();
  return "consume";
}
```

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- src/fast-hud-view.test.ts src/fast-hud-input-controller.test.ts`

Expected: PASS.

### Task 2: Add an explicit Realtime response cancellation boundary

**Files:**
- Modify: `src/ai-realtime-session.ts`
- Modify: `src/ai-realtime-session.test.ts`
- Modify: `src/ai-realtime-protocol.ts`
- Modify: `src/ai-realtime-protocol.test.ts`

- [ ] **Step 1: Write failing session and protocol tests**

Start a fake socket, stream a response with ID `r1`, call
`cancelResponse()`, and assert the final client event is:

```ts
{ type: "response.cancel", response_id: "r1" }
```

Then feed a late `response.output_text.delta` for `r1` and assert it does not
change the active assistant text.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm test -- src/ai-realtime-session.test.ts src/ai-realtime-protocol.test.ts`

Expected: FAIL because cancellation and local retirement are not exposed.

- [ ] **Step 3: Implement best-effort cancellation**

Add `cancelResponse(): AiRealtimeProtocolState` to `AiRealtimeSession`. When an active response exists, send `response.cancel`. Archive/retire the response with its received text. Set the phase to `listening`. Publish the new state. Return the state. When no generating response exists, return the current state without
sending.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- src/ai-realtime-session.test.ts src/ai-realtime-protocol.test.ts`

Expected: PASS.

### Task 3: Flush the presentation target and halve the cadence

**Files:**
- Modify: `src/ai-presentation-pacer.ts`
- Modify: `src/ai-presentation-pacer.test.ts`

- [ ] **Step 1: Write failing pacer tests**

Change cadence expectations to 250 ms. Add a test that calls `flush()` while idle and sees the full target immediately. Add another test that holds the current `onFrame` promise and calls `flush()`. Verify that the full target appears exactly once after the promise resolves.

- [ ] **Step 2: Run the pacer test and confirm failure**

Run: `npm test -- src/ai-presentation-pacer.test.ts`

Expected: FAIL because the default is 500 ms and `flush()` does not exist.

- [ ] **Step 3: Implement replace-latest flush semantics**

Expose `flush(): Promise<void>`. Clear the timer, mark archived and current
assistant targets fully presented, and emit one `waitForPresentation` frame.
If a frame is in flight, set one pending-flush flag and perform the same action
after its promise settles. Change the default interval to `250`.

- [ ] **Step 4: Run the pacer test**

Run: `npm test -- src/ai-presentation-pacer.test.ts`

Expected: PASS.

### Task 4: Coordinate interruption in the runtime

**Files:**
- Modify: `src/ai-runtime.ts`
- Modify: `src/ai-runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

For `thinking`, assert `interrupt()` calls the session cancellation once,
publishes the received partial assistant text in full, and ends in `listening`.
For a completed `listening` response still being paced, assert `interrupt()`
does not cancel the session and flushes the complete authoritative answer.

- [ ] **Step 2: Run the runtime test and confirm failure**

Run: `npm test -- src/ai-runtime.test.ts`

Expected: FAIL because `AiRuntime.interrupt()` does not exist.

- [ ] **Step 3: Implement runtime coordination**

Track the latest authoritative protocol. Add `interrupt(): Promise<void>` that
calls `session.cancelResponse()` only for `thinking`, pushes the resulting
listening snapshot into the pacer, and awaits `pacer.flush()`.

- [ ] **Step 4: Run all Ask AI focused tests**

Run: `npm test -- src/ai-realtime-protocol.test.ts src/ai-realtime-session.test.ts src/ai-presentation-pacer.test.ts src/ai-runtime.test.ts src/fast-hud-view.test.ts src/fast-hud-input-controller.test.ts`

Expected: PASS.

### Task 5: Update durable rules and verify the product

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-01-ai-line-stream-design.md`

- [ ] **Step 1: Update the established contract**

Replace the 500 ms/no-op tap rules with the 250 ms acknowledgement-paced rule
and the completed-flush/active-cancel tap behavior. Preserve double tap as the
only session exit.

- [ ] **Step 2: Run fresh full verification**

Run: `npm test && npm run build`

Expected: all Vitest tests pass and Vite production build exits 0.

- [ ] **Step 3: Inspect the diff and commit**

Run: `git diff --check && git status --short`

Expected: no whitespace errors. Only the planned source, tests, and docs are
modified. Commit with `feat: interrupt Ask AI responses on tap` and push main.

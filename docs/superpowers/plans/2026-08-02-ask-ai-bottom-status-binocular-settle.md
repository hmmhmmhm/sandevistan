# Ask AI Bottom Status and Binocular Restore Settle Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED AND INTEGRATED`

Implementation commit: `d3d3663` (`fix: settle Ask AI binocular restore`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Thinking and tool activity below the native Ask AI transcript and add a bounded post-rebuild barrier before restoring all four HUD tiles.

**Architecture:** Keep native transcript formatting pure in `native-ai-text.ts`. Extend the existing native-AI transport with one injected page-ready wait. Default to 200 ms in production. In tests, use a no-op or a controlled promise. Preserve the established neutral-page transition, four-call image pipeline, busy-drop behavior, and fail-fast semantics.

**Tech Stack:** TypeScript, Vitest, Even Hub SDK 0.0.13, Vite.

---

### Task 1: Move transient activity to the transcript bottom

**Files:**
- Modify: `src/native-ai-text.test.ts`
- Modify: `src/native-ai-text.ts`

- [ ] **Step 1: Write failing formatter assertions**

Change the tool-status assertion to require the transcript first, one blank row,
and the localized Web search status last. Change the rolling-viewport assertion
to require Thinking after the final transcript row:

```ts
const lines = createNativeAiTextContent(tool, 0, "en").split("\n");
expect(lines[0]).toBe("YOU // private question");
expect(lines.at(-2)).toBe("");
expect(lines.at(-1)).toBe("WEB SEARCH…");

expect(latest[0]).toBe("AI // line 6");
expect(latest.at(-2)).toBe("");
expect(latest.at(-1)).toBe("THINKING…");
```

- [ ] **Step 2: Verify the formatter test fails**

Run:

```bash
npm test -- --run src/native-ai-text.test.ts
```

Expected: failure because Web search and Thinking are currently the first row.

- [ ] **Step 3: Implement one trailing activity slot**

In `createNativeAiTextContent`, classify `activeTool`, `thinking`, and
`listening` as trailing activity. Reserve two rows. Render the transcript content.
Append one blank row plus the localized status. Keep `displaying` hidden.
Keep the MCP approval branch unchanged.

- [ ] **Step 4: Verify formatter behavior**

Run the same focused test and expect every native formatter test to pass.

### Task 2: Wait for the bilateral image page before sending tiles

**Files:**
- Modify: `src/fast-canvas-types.ts`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/fast-native-ai-text-transport.ts`
- Modify: `src/glasses.test.ts`

- [ ] **Step 1: Write failing transport-order tests**

Extend the fast transport harness with a controlled `waitForPageReady` callback
and transition events. Require this order after native AI entry:

```ts
expect(events).toEqual([
  "rebuild:neutral",
  "rebuild:image",
  "wait:200",
  "encode:3,5,2,4",
  "image:3",
  "image:5",
  "image:2",
  "image:4",
]);
```

Add a controlled wait promise and prove `nativeText.update("LATE AI FRAME")`
returns `false` without calling `textContainerUpgrade` while the wait is active.

- [ ] **Step 2: Verify the transport tests fail**

Run:

```bash
npm test -- --run src/glasses.test.ts -t "native AI|bilateral restore"
```

Expected: failure because no page-ready callback occurs between image rebuild
and image encoding.

- [ ] **Step 3: Add the bounded readiness dependency**

Add this optional transport dependency:

```ts
waitForPageReady?: (milliseconds: number) => Promise<void>;
```

Expose `NATIVE_AI_IMAGE_PAGE_SETTLE_MS = 200`. After `mode.leave()` succeeds,
await the injected callback or a `setTimeout`-backed default.
Log `native AI image page ready · 200ms`. Invalidate the image cache.
Call the unchanged four-tile restore. Keep `restoringImages` true across the wait.

- [ ] **Step 4: Verify transport and input behavior**

Run:

```bash
npm test -- --run src/glasses.test.ts src/fast-hud-input-controller.test.ts src/native-ai-text.test.ts
npm run typecheck
```

Expected: all focused tests and type checking pass.

### Task 3: Record the durable contract and verify the repository

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the durable Ask AI exit contract**

Record that Thinking and tool statuses are trailing, and that AI exit waits
200 ms after the image page rebuild before starting IDs 3/5/2/4. State that the
wait is AI-exit-only and does not introduce retries or queued work.

- [ ] **Step 2: Run complete verification**

```bash
npm test
npm run typecheck
npm run test:repo
npm run test:sites
npm run pack
git diff --check
```

Expected: zero failures. The only acceptable build note is the existing Vite
chunk-size warning.

- [ ] **Step 3: Commit and deploy the hardware preview**

```bash
git add AGENTS.md src docs/superpowers/plans
git commit -m "fix: settle Ask AI binocular restore"
git push origin main
```

Restart the existing Vite preview on port 4179 and verify both
`http://127.0.0.1:4179/hud-canvas-fast` and
`http://100.127.255.11:4179/hud-canvas-fast` return HTTP 200.

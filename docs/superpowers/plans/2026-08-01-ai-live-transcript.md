# Ask AI Live Transcript Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED, THEN SUPERSEDED AT THE PRESENTATION LAYER`

Implementation commits: `3ca7218`, `707d918`, and `b04fe0c`

The retained-turn protocol remains active. The Canvas page presentation was
later replaced by the native Text line stream.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the current user utterance and streaming AI answer in one automatically following chat viewport, while keeping manual scrolling pinned to older conversation pages.

**Architecture:** Extend the Realtime protocol state with a bounded completed-turn timeline. In a renderer-independent helper, convert the full timeline into contiguous six-line transcript pages. Extend the HUD view state with an explicit follow-latest flag so incoming deltas move only the live viewport. The canvas renderer consumes the selected page and can later be replaced by an SDK text-container renderer without changing conversation state.

**Tech Stack:** TypeScript, Vitest, React canvas HUD, OpenAI Realtime protocol, Even Hub SDK 0.0.13

---

### Task 1: Preserve completed Realtime turns

**Files:**
- Modify: `src/ai-realtime-protocol.ts`
- Modify: `src/ai-realtime-protocol.test.ts`

- [ ] **Step 1: Write the failing reducer test**

Add a test that completes a first user/assistant exchange, emits
`input_audio_buffer.speech_started`, and expects the first exchange in
`state.turns` while the current fields are empty:

```ts
expect(state.turns).toEqual([{
  user: "First question",
  assistant: "First answer",
}]);
expect(state.userText).toBe("");
expect(state.assistantText).toBe("");
```

- [ ] **Step 2: Run the reducer test and verify RED**

Run: `npx vitest run src/ai-realtime-protocol.test.ts`

Expected: FAIL because `turns` does not exist.

- [ ] **Step 3: Add the bounded turn model**

Add this public type and state field:

```ts
export type AiConversationTurn = {
  readonly user: string;
  readonly assistant: string;
};

export type AiRealtimeProtocolState = {
  // existing fields
  readonly turns: readonly AiConversationTurn[];
};
```

Initialize `turns: []`. Before clearing current text on `speech_started`, append a non-empty current turn. Retain the newest twelve turns. Trim the oldest turns until the completed-turn payload is at most 8,000 characters. Usage fields must
remain cumulative.

- [ ] **Step 4: Run protocol tests and verify GREEN**

Run: `npx vitest run src/ai-realtime-protocol.test.ts`

Expected: all protocol tests pass.

### Task 2: Compose chronological conversation pages

**Files:**
- Create: `src/ai-transcript.ts`
- Create: `src/ai-transcript.test.ts`
- Modify: `src/ai-hud-state.ts`
- Modify: `src/ai-hud-state.test.ts`
- Modify: `src/ai-runtime.ts`
- Modify: `src/ai-runtime.test.ts`

- [ ] **Step 1: Write failing page-composition tests**

Define the desired API:

```ts
expect(createAiTranscriptPages(
  [],
  { user: "Hello", assistant: "Hello. How can I help?" },
)).toEqual(["YOU // Hello\nAI // Hello. How can I help?"]);
```

Add a long multi-turn case that expects chronological pages of no more than six
newline-delimited lines and retains both role labels.

- [ ] **Step 2: Run the transcript tests and verify RED**

Run: `npx vitest run src/ai-transcript.test.ts src/ai-hud-state.test.ts`

Expected: FAIL because the transcript composer does not exist and the snapshot
still creates separate role pages.

- [ ] **Step 3: Implement the pure transcript composer**

Create:

```ts
export function createAiTranscriptPages(
  completed: readonly AiConversationTurn[],
  current: AiConversationTurn,
): readonly string[];
```

Wrap each role to the HUD line width. Prefix only the first wrapped line with `YOU //` or `AI //`. Pack chronological lines into six-line pages. Return newline-delimited page strings. Empty roles emit no lines.

Update `updateAiHudProtocol` to build pages from `protocol.turns` plus the
current fields. Update runtime persistence to select the current turn when
non-empty, otherwise the newest completed turn, so stopping between turns does
not lose the last exchange.

- [ ] **Step 4: Run state and runtime tests and verify GREEN**

Run: `npx vitest run src/ai-transcript.test.ts src/ai-hud-state.test.ts src/ai-runtime.test.ts`

Expected: all selected tests pass.

### Task 3: Follow live output and pin manual history

**Files:**
- Modify: `src/fast-hud-view.ts`
- Modify: `src/fast-hud-view.test.ts`

- [ ] **Step 1: Write failing follow-mode tests**

Test these transitions:

```ts
// Enter Ask AI on the last page and follow it.
expect(entered.state).toMatchObject({ aiPage: 2, aiFollowsLatest: true });

// A new page appears while following.
expect(syncFastHudView(entered.state, { ...context, aiPageCount: 4 }))
  .toMatchObject({ aiPage: 3, aiFollowsLatest: true });

// Scroll backward, remain pinned after another page appears.
expect(pinned).toMatchObject({ aiPage: 2, aiFollowsLatest: false });

// Scroll to the last page, resume following.
expect(liveAgain).toMatchObject({ aiPage: 4, aiFollowsLatest: true });
```

- [ ] **Step 2: Run the view test and verify RED**

Run: `npx vitest run src/fast-hud-view.test.ts`

Expected: FAIL because `aiFollowsLatest` is missing and AI opens at page zero.

- [ ] **Step 3: Implement explicit follow state**

Add `aiFollowsLatest: boolean` to `FastHudViewState`, initialized to `true`.
Entering AI detail selects `aiPageCount - 1`. `syncFastHudView` selects the
latest page only while following. Scrolling toward an older page disables
following; reaching the last page enables it again. Other detail modes and map
zoom directions remain unchanged.

- [ ] **Step 4: Run view tests and verify GREEN**

Run: `npx vitest run src/fast-hud-view.test.ts`

Expected: all view tests pass.

### Task 4: Render a combined live chat viewport

**Files:**
- Modify: `src/fast-ai-hud.ts`
- Modify: `src/fast-detail-hud.test.ts`
- Modify: `src/ai-i18n.ts`
- Modify: `src/ai-i18n.test.ts`

- [ ] **Step 1: Write the failing renderer test**

Render a snapshot whose only page is:

```text
YOU // Hello
AI // Hello. How can I help?
```

Assert both role lines are passed to canvas text drawing, the position contains
`LIVE`, and an older selected page contains `HISTORY`.

- [ ] **Step 2: Run renderer tests and verify RED**

Run: `npx vitest run src/fast-detail-hud.test.ts src/ai-i18n.test.ts`

Expected: FAIL because the renderer rewrites each page as one wrapped paragraph
and does not mark live versus history.

- [ ] **Step 3: Render newline-preserving pages**

Split a transcript page on newlines and draw all six lines with a consistent
21 px chat font. Show `LIVE n/n` for the newest page and `HISTORY n/N` for a
pinned older page. Keep errors and empty prompts wrapped with the existing
helper. Add typed localized strings for live/history labels with English
fallbacks across all supported locales.

- [ ] **Step 4: Run renderer tests and verify GREEN**

Run: `npx vitest run src/fast-detail-hud.test.ts src/ai-i18n.test.ts`

Expected: all selected tests pass.

### Task 5: Full verification and delivery

**Files:**
- Modify only if verification exposes a regression.

- [ ] **Step 1: Run focused AI and navigation tests**

Run:

```bash
npx vitest run \
  src/ai-realtime-protocol.test.ts \
  src/ai-transcript.test.ts \
  src/ai-hud-state.test.ts \
  src/ai-runtime.test.ts \
  src/fast-hud-view.test.ts \
  src/fast-detail-hud.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run all repository gates**

Run:

```bash
npm test
npm run typecheck
npm run test:repo
npm run test:sites
npm run pack
git diff --check
```

Expected: every command exits zero and `sandevistan.ehpk` is created.

- [ ] **Step 3: Perform mobile canvas visual verification**

Open `/hud-canvas-fast` at a mobile viewport with a seeded AI snapshot and
inspect the live latest page and a pinned history page. Verify both roles share
the frame, six lines do not clip, and the header clearly distinguishes live
from history.

- [ ] **Step 4: Commit and push**

```bash
git add src docs/superpowers/plans/2026-08-01-ai-live-transcript.md
git commit -m "feat: stream Ask AI conversation in one viewport"
git push origin main
```

Expected: local and remote `main` point at the same commit and the worktree is
clean.

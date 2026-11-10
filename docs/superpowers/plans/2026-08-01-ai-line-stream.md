# Ask AI Line Stream Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED, THEN EVOLVED`

Initial implementation commit: `f75dd1a`

The rolling line stream remains active. Its original fixed 20 ms reveal was
replaced by acknowledgement-paced, user-configurable response presentation.

> Implement in the isolated `feature/ask-ai-line-stream` worktree with TDD.

**Goal:** Replace page-based Ask AI presentation with a minimal rolling
line transcript and a one-grapheme-per-20-ms assistant reveal.

**Architecture:** Keep OpenAI Realtime authoritative state unchanged. Derive a
presentation snapshot through a local grapheme pacer. Wrap the transcript into lines. Render a rolling line viewport through the existing native Text container. Keep native bridge refresh latest-wins.

**Tech Stack:** TypeScript, Vitest fake timers, Even Hub SDK 0.0.13, Canvas
fallback, Vite.

---

### Task 1: Define line transcript and 20 ms pacing behavior

**Files:**
- Modify: `src/ai-transcript.test.ts`
- Modify: `src/ai-presentation-pacer.test.ts`
- Modify: `src/ai-transcript.ts`
- Modify: `src/ai-presentation-pacer.ts`

1. Write failing tests for chronological lines, no page packing, one Unicode
   grapheme per 20 ms, immediate user speech, and newest-target semantics.
2. Run the focused tests and confirm the expected failures.
3. Implement grapheme segmentation with `Intl.Segmenter` plus an `Array.from`
   fallback and rebuild presentation transcript lines on every frame.
4. Run the focused tests until green.

### Task 2: Replace AI page state with one-line navigation

**Files:**
- Modify: `src/ai-hud-state.ts`
- Modify: `src/ai-hud-state.test.ts`
- Modify: `src/fast-hud-view.ts`
- Modify: `src/fast-hud-view.test.ts`
- Modify: `src/fast-hud-render.ts`
- Modify: `src/fast-detail-hud.ts`

1. Write failing state/reducer tests for `transcriptLines`, latest line entry,
   one-line older/newer scrolling, and history pinning.
2. Replace page fields and context with line fields.
3. Update render/controller call sites and run focused tests.

### Task 3: Simplify native Text and Canvas fallback presentation

**Files:**
- Modify: `src/native-ai-text.test.ts`
- Modify: `src/native-ai-text.ts`
- Modify: `src/fast-ai-hud.ts`
- Modify: `src/fast-detail-hud.test.ts`
- Modify: `src/ai-hud-i18n.ts`
- Modify: `src/ai-hud-i18n.test.ts`

1. Write failing tests proving header/frame/counter/footer removal, localized
   `Listening…`, chronological role lines, bounded viewport, and one-line
   selection.
2. Implement a minimal rolling native Text body and matching Canvas fallback.
3. Preserve actionable key/error messages and all thirty locale dictionaries.
4. Run focused tests until green.

### Task 4: Integrate and verify

**Files:**
- Modify: `src/fast-hud-controller.ts`
- Modify: `src/fast-hud-input-controller.test.ts`
- Modify: `AGENTS.md`

1. Wire native content to the selected transcript line and update durable
   project guidance.
2. Run all unit tests and `npm run build`.
3. Run package/Sites verification commands from `package.json`.
4. Review the diff for accidental page UI, secrets, or unrelated changes.
5. Commit, merge into `main`, push, rebuild the EHPK, restart the Tailscale
   test server, and verify the reachable URL.

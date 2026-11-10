# Source Module Size Gate Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Restore and permanently enforce Sandevistan's 450-line maximum for custom implementation files without changing runtime behavior.

**Architecture:** Add a repository-policy check for tracked, non-test TypeScript, TSX, and CSS implementation files. Split the oversized Realtime protocol, Realtime session, and React entry module at existing responsibility boundaries while preserving their public imports and hardware-proven behavior.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Node test runner, Vite 6.

---

### Task 1: Add the failing repository size policy

**Files:**
- Modify: `scripts/check-repository-copy.mjs`
- Modify: `tests/repository-copy.test.mjs`

- [x] **Step 1: Write a policy test that supplies a 451-line implementation entry and expects one `Implementation file exceeds 450 lines` violation while ignoring test files.**
- [x] **Step 2: Run `node --test tests/repository-copy.test.mjs` and verify it fails because `findOversizedImplementationFiles` does not exist.**
- [x] **Step 3: Implement `findOversizedImplementationFiles(entries, maximumLines = 450)`, collect tracked `src/**/*.ts`, `src/**/*.tsx`, and `src/**/*.css` files, exclude test files, and include its results in `checkRepository`.**
- [x] **Step 4: Run `node --test tests/repository-copy.test.mjs` and verify the unit test passes. Then run `node scripts/check-repository-copy.mjs` and verify it fails only for the three currently oversized modules.**

### Task 2: Split Realtime protocol encoding, configuration, and usage parsing

**Files:**
- Create: `src/ai-realtime-audio.ts`
- Create: `src/ai-realtime-session-update.ts`
- Create: `src/ai-realtime-usage.ts`
- Modify: `src/ai-realtime-protocol.ts`
- Test: `src/ai-realtime-protocol.test.ts`

- [x] **Step 1: Move PCM Base64 encoding and 16-to-24 kHz resampling unchanged into `ai-realtime-audio.ts`.**
- [x] **Step 2: Move localized Realtime session configuration and MCP tool projection unchanged into `ai-realtime-session-update.ts`.**
- [x] **Step 3: Move the bounded Realtime server-event type and usage parsers into `ai-realtime-usage.ts`.**
- [x] **Step 4: Re-export the existing public helpers from `ai-realtime-protocol.ts`, import the usage parsers for the reducer, and keep the protocol module below 450 lines.**
- [x] **Step 5: Run `npx vitest run src/ai-realtime-protocol.test.ts --no-file-parallelism --maxWorkers=1` and verify all protocol, audio, locale, MCP, and usage behavior remains green.**

### Task 3: Split Realtime session support responsibilities

**Files:**
- Create: `src/ai-realtime-token.ts`
- Create: `src/ai-realtime-search-usage.ts`
- Modify: `src/ai-realtime-session.ts`
- Test: `src/ai-realtime-session.test.ts`

- [x] **Step 1: Extract the BYOK ephemeral-secret request, JSON validation, and generic failure behavior into `requestRealtimeClientSecret`.**
- [x] **Step 2: Extract citation de-duplication and search usage/charge accumulation into pure helpers that return a new protocol state.**
- [x] **Step 3: Replace the inline implementations in `createAiRealtimeSession`, retaining cancellation, logging boundaries, and state event names unchanged, and keep the session module below 450 lines.**
- [x] **Step 4: Run `npx vitest run src/ai-realtime-session.test.ts src/ai-web-search.test.ts --no-file-parallelism --maxWorkers=1` and verify token, search-cost, tool, microphone, cancel, and cleanup tests pass.**

### Task 4: Split HUD route-mode resolution from the React entry

**Files:**
- Create: `src/hud-mode-resolution.ts`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [x] **Step 1: Move pathname-derived `HudControllerModes` construction into a pure `resolveHudControllerModes(pathname, search)` helper.**
- [x] **Step 2: Use the returned booleans in `App` without changing route selection, diagnostics, renderer metadata, or UI copy, and keep `App.tsx` below 450 lines.**
- [x] **Step 3: Run `npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1` and verify all route and transport integration tests pass.**

### Task 5: Verify, document, and publish

**Files:**
- Modify: `AGENTS.md` only if the enforced policy wording needs clarification
- Modify: `docs/superpowers/plans/2026-08-02-source-module-size-gate.md`

- [x] **Step 1: Mark completed plan checkboxes and run `node scripts/check-repository-copy.mjs`; expect no oversized implementation files.**
- [x] **Step 2: Run `npm test`, `npm run typecheck`, `npm run test:repo`, `npm run test:sites`, `npm run pack`, and `git diff --check`; expect zero failures.**
- [x] **Step 3: Confirm the query-free `/hud-canvas-fast` still resolves image pipeline concurrency to one and the preview returns HTTP 200.**
- [x] **Step 4: Commit the focused refactor, push `main`, and verify local and remote commit IDs match.**

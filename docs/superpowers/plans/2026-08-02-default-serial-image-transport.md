# Default Serial Image Transport Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED AND INTEGRATED`

Implementation commit: `ad23ccc` (`fix: default image transport to serial`)

The current `main` verification baseline is recorded in the
[2026-08-02 project readiness audit](../../hardware/2026-08-02-project-readiness-audit.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the query-free fast HUD send image tiles one at a time while retaining explicit pipeline values `2`, `3`, and `4` for controlled experiments.

**Architecture:** Keep the existing bounded transport and tile ordering unchanged. Change only the query resolver's fallback for missing or invalid values from concurrency `4` to `1`. Verify the behavior at resolver and App integration boundaries. Align durable documentation with the production default.

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library, Even Hub SDK 0.0.13

---

### Task 1: Lock the serial default with failing tests

**Files:**
- Modify: `src/image-send-concurrency.test.ts`
- Modify: `src/App.test.tsx`

- [x] **Step 1: Change resolver expectations for missing and invalid values**

Update the table in `src/image-send-concurrency.test.ts` so the missing value and invalid values `0`, `5`, and `two` expect `1`. Keep explicit values `1` through `4` unchanged.

- [x] **Step 2: Add App integration coverage for the production route**

Add a test that opens `/hud-canvas-fast`, starts `App`, waits for `transmitFast`, and asserts `fastOptions().imageSendConcurrency` is `1`. Rename the invalid-pipeline test to describe serial fallback and change its expected value from `4` to `1`. Keep the explicit pipeline `2` and `4` tests unchanged.

- [x] **Step 3: Run focused tests and verify the old implementation fails**

Run:

```bash
npm test -- --run src/image-send-concurrency.test.ts src/App.test.tsx
```

Expected: FAIL because the current resolver returns `4` for missing and invalid pipeline values.

### Task 2: Implement the minimal resolver change

**Files:**
- Modify: `src/image-send-concurrency.ts`

- [x] **Step 1: Change the fallback concurrency**

Keep the explicit branches for `1`, `2`, and `3`, then change the final fallback from `return 4` to `return value === "4" ? 4 : 1`. This preserves explicit `pipeline=4` and makes every missing or invalid value serial.

- [x] **Step 2: Run focused tests and verify they pass**

Run:

```bash
npm test -- --run src/image-send-concurrency.test.ts src/App.test.tsx
```

Expected: PASS with the production route at concurrency `1` and explicit experimental values preserved.

- [x] **Step 3: Run bounded transport regression coverage**

Run:

```bash
npm test -- --run src/bounded-task-pool.test.ts src/glasses.test.ts
```

Expected: PASS, proving concurrency `1` remains serial without changing send order, unchanged-tile skipping, failure handling, or retry behavior.

### Task 3: Align durable documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

- [x] **Step 1: Update the repository guardrail**

State that the query-free route defaults to one in-flight SDK image call with the `hud-4` palette. Explicit `pipeline=2`, `3`, and `4` remain diagnostic experiments. `levels=original` remains the palette rollback.

- [x] **Step 2: Update the README transport description**

Describe the four 288×144 tiles as passing through a bounded serial SDK transport by default. State that missing or invalid pipeline values resolve to one, explicit values `1` through `4` remain available, and the full serial/original comparison path is `?pipeline=1&levels=original`.

### Task 4: Verify, commit, integrate, and deploy

**Files:**
- Verify: all modified files

- [x] **Step 1: Run the complete verification gates**

Run:

```bash
npm test
npm run typecheck
npm run test:repo
npm run test:sites
npm run pack
git diff --check
```

Expected: every command exits `0`. The existing Vite chunk-size warning is informational.

- [x] **Step 2: Commit the implementation**

Run:

```bash
git add src/image-send-concurrency.ts src/image-send-concurrency.test.ts src/App.test.tsx AGENTS.md README.md
git commit -m "fix: default image transport to serial"
```

- [x] **Step 3: Integrate into `main` and verify the merged tree**

Fast-forward `main` to the implementation branch, rerun the full test suite on `main`, and remove the temporary worktree and branch after verification.

- [x] **Step 4: Push and refresh the hardware preview**

Push `main` to `origin`, rebuild the app, restart the exact preview listener on port `4179`, and verify both URLs return HTTP `200`:

```text
http://127.0.0.1:4179/hud-canvas-fast
http://100.127.255.11:4179/hud-canvas-fast
```

On physical hardware, the startup trace should include `transport start · pipeline 1`.

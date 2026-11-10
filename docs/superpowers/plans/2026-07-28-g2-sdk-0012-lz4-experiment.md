# G2 SDK 0.0.12 LZ4 Experiment Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate and hardware-test the Even Hub SDK 0.0.12 LZ4 image transport without changing the proven G2 HUD rendering or scheduling behavior.

**Architecture:** Keep the existing four PNG tiles, serial send order, timeout, and no-queue busy-drop transport unchanged. Pin SDK 0.0.12 across package and app manifests, expose a unique `sdk-lz4-030` hardware URL, and compare physical transfer logs against the pushed 0.0.11 checkpoint.

**Tech Stack:** Even Hub SDK 0.0.12, TypeScript 5.9, Vitest 4, Vite 6, Even Hub CLI.

---

### Task 1: Pin the isolated SDK experiment

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`

- [ ] Change the compatibility test to require exact SDK `0.0.12`,
  `min_sdk_version` parity, the `sdk=0.0.12` query, and build
  `sdk-lz4-030`.
- [ ] Run
  `npx vitest run src/sdk-version.test.ts --no-file-parallelism --maxWorkers=1`
  and confirm it fails because the manifests still use `0.0.11`.
- [ ] Run
  `npm install --save-exact @evenrealities/even_hub_sdk@0.0.12`.
- [ ] Change `app.json.min_sdk_version` to `0.0.12` and the QR URL to
  `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.12&build=sdk-lz4-030`.
- [ ] Assert that the unchanged public `ImageRawDataUpdate` input gains the
  SDK-provided `compressMode: 2` JSON field used by the LZ4 bridge path.
- [ ] Run the focused test again and confirm both tests pass.
- [ ] Commit with `chore: test Even Hub SDK 0.0.12 image transport`.

### Task 2: Record the hardware gate

**Files:**
- Modify: `README.md`
- Create: `docs/hardware/2026-07-28-sdk-0012-lz4-experiment.md`

- [ ] Update the README current experiment section to distinguish the pushed
  0.0.11 baseline from the local 0.0.12 LZ4 experiment.
- [ ] Record the baseline commit, unchanged transport invariants, test URL,
  serial test procedure, and pass/fail fields in the hardware note.
- [ ] Run `git diff --check`.
- [ ] Commit with `docs: prepare SDK 0.0.12 G2 hardware gate`.

### Task 3: Verify and serve the experiment

**Files:**
- No production source changes.

- [ ] Run `npm test`.
- [ ] Run `npm run test:sites`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Start or refresh the single Vite server on Tailscale port 4176.
- [ ] Confirm HTTP 200 at
  `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.12&build=sdk-lz4-030`.
- [ ] Confirm `git status --short --branch` contains only committed experiment
  changes and remains ahead of the pushed 0.0.11 baseline.
- [ ] Do not push the experiment commits until the physical G2 gate passes.

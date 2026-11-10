# G2 Unchanged Tile Skip Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avoid slow G2 SDK image calls when a newly encoded tile is byte-for-byte identical to the last payload successfully shown in that tile.

**Architecture:** Keep encoding and the existing serial `updateImageRawData` loop, but add a four-entry successful-payload cache inside each `transmitCanvas` instance. Compare exact bytes before each SDK call, update only after success, and log sent/skipped totals without adding refresh queues or retries.

**Tech Stack:** TypeScript 5.9, Even Hub SDK 0.0.11, Uint8Array, Vitest 4 with jsdom, Vite 6.

---

### Task 1: Specify successful-payload cache behavior

**Files:**
- Modify: `src/glasses.test.ts`

- [ ] Change the fast refresh harness default encoder to include the encode
  attempt in its test bytes so existing page-change tests still model changed
  pixels:

```ts
ids.map((id) => new Uint8Array([id, currentEncodeAttempt]))
```

- [ ] Add a test whose encoder returns stable `[id]` bytes, requests `right`,
  and expects the initial `[3, 5, 2, 4]` calls only plus
  `skipped · unchanged` diagnostics for IDs 3 and 5.
- [ ] Add a test that returns the initial bytes for ID 3 and changed bytes for
  ID 5, then expects only ID 5 to be appended to `imageIds`.
- [ ] Add a partial-failure test where changed ID 3 succeeds, changed ID 5
  returns `sendFailed`, and the next independent request sends only ID 5.
- [ ] Make the existing hide/restore encoder include a source discriminator:

```ts
ids.map((id) => new Uint8Array([id, source === "black" ? 1 : 0]))
```

- [ ] Run
  `npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1`
  and confirm the new unchanged-tile tests fail because every encoded target
  still calls the bridge.

### Task 2: Implement exact per-tile skipping

**Files:**
- Modify: `src/fast-canvas-transport.ts`

- [ ] Add an exact helper:

```ts
function equalBytes(left: Uint8Array | undefined, right: Uint8Array) {
  if (!left || left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < right.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
```

- [ ] Create `const lastSuccessfulPayload = new Map<number, Uint8Array>()`
  after page creation and before `refreshImages`.
- [ ] In the existing serial callback, skip a tile when `equalBytes` succeeds,
  increment `skippedCount`, and log
  ```${tile.name} skipped · unchanged```.
- [ ] After a successful bridge result, store `bytes.slice()` for that tile and
  increment `sentCount`. Do not modify the map on failure, exception, timeout,
  cancellation, or encode failure.
- [ ] After the serial loop, log:

```ts
logDiagnostic(
  "REFRESH",
  `image refresh complete · sent ${sentCount} · skipped ${skippedCount}`,
);
```

- [ ] Run the focused glasses test and confirm all transport tests pass.
- [ ] Run `git diff --check`.
- [ ] Commit with `feat: skip unchanged G2 image tiles`.

### Task 3: Prepare the physical G2 experiment

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Modify: `README.md`
- Create: `docs/hardware/2026-07-28-g2-unchanged-tile-skip.md`

- [ ] Change the QR contract test to require:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=dirty-tiles-032
```

- [ ] Run the SDK version test and confirm it fails on the old
  `sdk-lz4-fallback-031` build label.
- [ ] Update only the QR build label in `package.json`. Keep SDK 0.0.11 exact.
- [ ] Document the initial-send, stable-repeat, one-tile-change, partial-failure,
  hide/restore, and busy-drop physical checks.
- [ ] Update README's active physical URL and add the hardware record link.
- [ ] Run the SDK version test and confirm both tests pass.
- [ ] Commit with `docs: prepare unchanged tile G2 hardware gate`.

### Task 4: Verify and serve serially

**Files:**
- Modify after verification:
  `docs/hardware/2026-07-28-g2-unchanged-tile-skip.md`

- [ ] Run `npm test`.
- [ ] Run `npm run test:sites`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Record exact test counts and build result in the hardware note.
- [ ] Run `git diff --check`, then commit the verification evidence.
- [ ] Restart only the Vite process listening on Tailscale port 4176 so its
  dependency and source cache are fresh.
- [ ] Confirm HTTP 200 at
  `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=dirty-tiles-032`.
- [ ] Keep all experiment commits local until the user confirms the physical G2
  gate.

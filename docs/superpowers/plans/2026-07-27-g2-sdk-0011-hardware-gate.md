# G2 SDK 0.0.11 Hardware Gate Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin Even Hub SDK `0.0.11` and prove the unchanged fast Canvas HUD transport on the physical G2 before connecting live services.

**Architecture:** Change only dependency/manifest/QR metadata. Keep the current renderer and `ImageRawDataUpdate` call untouched so the physical test isolates the SDK version as the sole transport variable.

**Tech Stack:** Even Hub SDK `0.0.11`, Even Hub CLI, Vite, Vitest, TypeScript

**As-run deviation/completion:** The gate finished in two physical stages, so
the final approved artifact did not preserve the planned SDK-only variable.
First, commit `ebfb389` and build `fast-live-011` isolated SDK `0.0.11` while preserving row-major `2/3/4/5` full sends. Physical testing established bilateral display, all four tiles, normal 1→2→3→4 scrolling, and no `SENDFAILED`. The user then requested right-column-first loading. Commit
`df19655a40dc72a088fb702c8d3e1cade7e0274d` produced
`fast-right-first-011`, combining SDK `0.0.11` with the fast-route-only
`3/5/2/4` full-send order. The physical G2 confirmed that combined build,
including hide/restore, as the final live-data baseline. See
`docs/hardware/2026-07-27-sdk-0011-transport-success.md`.

---

### Task 1: Pin SDK 0.0.11 without enabling live data

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`

- [x] **Step 1: Write the failing SDK pin test**

Replace the first test in `src/sdk-version.test.ts` with:

```ts
it("pins the pre-LZ4 0.0.11 SDK for the fast HUD gate", () => {
  const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

  expect(installed).toBe("0.0.11");
  expect(appManifest.min_sdk_version).toBe(installed);
  expect(packageManifest.scripts.qr).toContain(
    "http://100.96.68.73:4176/hud-canvas-fast",
  );
  expect(packageManifest.scripts.qr).toContain("sdk=0.0.11");
  expect(packageManifest.scripts.qr).toContain("build=fast-live-011");
});
```

Retain the existing serialization test. Its expected JSON must remain:

```ts
{
  containerID: 3,
  containerName: "frame",
  imageData: [1, 2, 3],
}
```

- [x] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run src/sdk-version.test.ts
```

Expected: FAIL because dependency, manifest, and QR metadata still say
`0.0.10`.

- [x] **Step 3: Install the exact SDK and update metadata**

Run:

```bash
npm install --save-exact @evenrealities/even_hub_sdk@0.0.11
```

Set these exact values in `package.json`:

```json
{
  "scripts": {
    "qr": "evenhub qr --url \"http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fast-live-011\""
  },
  "dependencies": {
    "@evenrealities/even_hub_sdk": "0.0.11"
  }
}
```

Set:

```json
{
  "min_sdk_version": "0.0.11"
}
```

in `app.json`. Do not add permissions or live feature code in this task.

- [x] **Step 4: Verify the isolated SDK change**

```bash
npx vitest run src/sdk-version.test.ts src/glasses.test.ts src/App.test.tsx
npm run typecheck
npm run build
npm run test:sites
```

Expected at isolated commit `ebfb389`: all commands exit `0`;
`glasses.test.ts` asserts row-major full startup and hide/restore IDs
`2/3/4/5`, plus scroll IDs `3/5`.

- [x] **Step 5: Commit the isolated gate build**

```bash
git add package.json package-lock.json app.json src/sdk-version.test.ts
git commit -m "chore: pin Even Hub SDK 0.0.11"
```

### Task 2: Prove the isolated SDK 0.0.11 stage on the physical G2

**Files:**
- Carry into final success record:
  `docs/hardware/2026-07-27-sdk-0011-transport-success.md`
- Create on failure: `docs/hardware/2026-07-27-sdk-0011-transport-failure.md`

- [x] **Step 1: Start the hardware test build**

```bash
npm run dev -- --host 0.0.0.0 --port 4176
```

Open this complete Tailscale URL through Even Hub:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fast-live-011
```

- [x] **Step 2: Run the physical checklist**

Confirm in this order:

1. both lenses show the same `576 x 288` HUD;
2. startup completes with all four quadrants in row-major top-left, top-right,
   bottom-left, bottom-right order (`2/3/4/5`);
3. bottom scroll moves exactly one page forward using IDs `3/5`;
4. top scroll moves exactly one page backward using IDs `3/5`;
5. no `SENDFAILED` appears.

This isolated stage retains the existing row-major full-send contract.
User-forward paging remains 1→2→3→4, and no SDK event-direction inversion is
needed.

- [x] **Step 3: Retain the isolated observation**

If every check passes, carry this isolated-stage evidence into the final
success document:

```markdown
# SDK 0.0.11 G2 Transport Success

Date: 2026-07-27
Build: `fast-live-011`
URL: `/hud-canvas-fast?sdk=0.0.11&build=fast-live-011`
Result: PASS

- Bilateral row-major `2/3/4/5` four-tile startup: PASS
- Bottom/top `3/5` two-tile paging: PASS
- `SENDFAILED`: not observed

SDK `0.0.11` passes the isolated transport prerequisite. Final baseline
approval follows the requested combined send-order stage below.
```

If any check fails, create the failure document with the exact failing check and Even Hub status string. Keep SDK `0.0.10` as the live baseline. Stop this roadmap before phase 2.

- [x] **Step 4: Preserve the isolated observation for the final gate record**

The isolated SDK pin remains commit `ebfb389`. Because the user requested a
new full-send order after this observation, defer the durable success document
and live-data baseline declaration to the combined stage below.

### Task 3: Prove the combined SDK and right-column-first transport

**As-run implementation commit:** `df19655a40dc72a088fb702c8d3e1cade7e0274d`

- [x] **Step 1: Apply the fast-route-only full-send order**

Keep legacy full transfers row-major (`2/3/4/5`). For `/hud-canvas-fast`,
send full startup, hide, and restore transfers in right-top, right-bottom,
left-top, left-bottom order (`3/5/2/4`). Keep scroll transfers on `3/5`.

- [x] **Step 2: Verify the combined build**

At commit `df19655a40dc72a088fb702c8d3e1cade7e0274d`, source tests passed
53/53, typecheck and build exited `0`, and Sites tests passed 4/4.

- [x] **Step 3: Run the final physical checklist**

Open:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fast-right-first-011
```

Confirm:

1. bilateral display and all four quadrants;
2. full transfers visibly load in `3/5/2/4` order;
3. bottom scroll advances exactly one page in the existing 1→2→3→4 direction
   using only `3/5`;
4. top scroll moves exactly one page backward using only `3/5`;
5. double tap hides with a black `3/5/2/4` frame and the second double tap
   restores the current `3/5/2/4` frame;
6. no `SENDFAILED` appears.

- [x] **Step 4: Record and commit the final baseline**

Record the combined result in
`docs/hardware/2026-07-27-sdk-0011-transport-success.md`, add the durable
baseline instruction to `AGENTS.md`, and commit the result.

- [x] **Step 5: Point the current QR identity at the approved build**

Keep the route and `sdk=0.0.11` query unchanged, and set the active `npm run qr`
build tag to `fast-right-first-011`. Cover that identity in
`src/sdk-version.test.ts`.

Do not push the roadmap implementation before the user confirms this physical
gate.

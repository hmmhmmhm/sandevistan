# G2 Four-Call Image Transport Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `pipeline=4` G2 hardware experiment that starts all four full-frame SDK image calls without changing the serial default or refresh scheduling contract.

**Architecture:** Extend the literal URL setting to `1 | 2 | 3 | 4` and reuse the existing bounded per-refresh task runner. Add end-to-end option routing and physical-call concurrency coverage, then expose an isolated QR and Tailscale URL while retaining SDK `0.0.11`.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Even Hub SDK `0.0.11`, Canvas 2D, Vite 6

---

### Task 1: Accept the four-call experiment value

**Files:**
- Modify: `src/image-send-concurrency.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/image-send-concurrency.ts`

- [ ] **Step 1: Write failing resolver and application tests**

Change the resolver table so `pipeline=4` resolves to four and `pipeline=5`
falls back to one:

```ts
["?pipeline=4", 4],
["?pipeline=5", 1],
```

Extend `FastTestOptions.imageSendConcurrency` to `1 | 2 | 3 | 4`, then add:

```ts
it("passes the four-call image pipeline to the fast transport", async () => {
  window.history.replaceState({}, "", "/hud-canvas-fast?pipeline=4");
  mocks.transmitFast.mockResolvedValue(vi.fn());

  render(<App />);

  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());
  expect(fastOptions().imageSendConcurrency).toBe(4);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npx vitest run src/image-send-concurrency.test.ts src/App.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: resolver and application tests receive serial value one instead of
four.

- [ ] **Step 3: Extend the literal type and resolver**

```ts
export type ImageSendConcurrency = 1 | 2 | 3 | 4;

export function resolveImageSendConcurrency(
  search: string,
): ImageSendConcurrency {
  const value = new URLSearchParams(search).get("pipeline");
  if (value === "2") return 2;
  if (value === "3") return 3;
  if (value === "4") return 4;
  return 1;
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command.

Expected: all resolver and application tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/image-send-concurrency.ts src/image-send-concurrency.test.ts \
  src/App.test.tsx
git commit -m "feat: accept four-call G2 image pipeline"
```

### Task 2: Prove full-frame concurrency four

**Files:**
- Modify: `src/bounded-task-pool.test.ts`
- Modify: `src/glasses.test.ts`

- [ ] **Step 1: Extend test-only option types**

Change both `imageSendConcurrency?: 1 | 2 | 3` declarations in
`src/glasses.test.ts` to:

```ts
imageSendConcurrency?: 1 | 2 | 3 | 4;
```

- [ ] **Step 2: Add bounded-runner characterization**

Add `[4, 4]` to the existing `runBounded` limit table:

```ts
it.each([
  [1, 1],
  [3, 3],
  [4, 4],
])("enforces limit %i", async (limit, expectedMaximum) => {
```

This is characterization of the already generic runner and requires no
production runner change.

- [ ] **Step 3: Add the physical transport concurrency test**

```ts
it("pipelines all four full-frame image sends at limit four", async () => {
  const gates = new Map([
    [3, deferred()],
    [5, deferred()],
    [2, deferred()],
    [4, deferred()],
  ]);
  const harness = await createFastRefreshHarness({
    imageSendConcurrency: 4,
    update: async (id, _call, encodeAttempt) => {
      if (encodeAttempt === 2) await gates.get(id)?.promise;
      return "success";
    },
  });
  diagnosticLogger.clear();

  harness.request("all");
  await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([
    3,
    5,
    2,
    4,
  ]));

  expect(harness.maximumActiveImageSends).toBe(4);
  expect(diagnosticLogger.text()).toContain(
    "[TILE] sandevistanBL start · 4/4 · inflight 4/4",
  );

  for (const gate of gates.values()) gate.resolve();
  await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
    "[REFRESH] external all complete",
  ));
});
```

- [ ] **Step 4: Run transport coverage**

```bash
npx vitest run src/glasses.test.ts src/bounded-task-pool.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: all serial and pipeline one-through-four transport tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/glasses.test.ts src/bounded-task-pool.test.ts
git commit -m "test: cover four-call G2 image transport"
```

### Task 3: Expose and document pipeline four

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/hardware/2026-07-30-g2-pipelined-image-transport.md`

- [ ] **Step 1: Write the failing metadata test**

Add:

```ts
expect(scripts["qr:pipeline4"]).toContain(
  "http://100.127.255.11:4177/",
);
expect(scripts["qr:pipeline4"]).toContain(
  "sdk=0.0.11&pipeline=4&build=pipeline-4-038",
);
```

- [ ] **Step 2: Run the metadata test and verify RED**

```bash
npx vitest run src/sdk-version.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: `qr:pipeline4` is absent.

- [ ] **Step 3: Add the isolated QR command**

Add this script without changing stable `qr`:

```json
"qr:pipeline4": "evenhub qr --url \"http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&build=pipeline-4-038\""
```

- [ ] **Step 4: Update physical documentation**

Document the pipeline-four URL and ordered `1/4` through `4/4` diagnostics. Record the owner-approved direct comparison with pipeline two. Leave physical evidence fields empty. Document rollback to pipeline two or one.

Update README to state that this experimental branch accepts `pipeline=2`,
`pipeline=3`, or `pipeline=4`, and that no mode becomes the `main` default
without physical evidence.

- [ ] **Step 5: Run metadata and repository-copy checks**

```bash
npx vitest run src/sdk-version.test.ts --no-file-parallelism --maxWorkers=1
npm run test:repo
git diff --check
```

Expected: all checks pass and the repository remains English-only.

- [ ] **Step 6: Commit**

```bash
git add package.json src/sdk-version.test.ts README.md \
  docs/hardware/2026-07-30-g2-pipelined-image-transport.md
git commit -m "docs: prepare four-call G2 hardware gate"
```

### Task 4: Verify, push, and serve

**Files:**
- Modify only if a scoped verification failure identifies a defect.

- [ ] **Step 1: Run every gate serially**

```bash
git diff --check
npm run test:repo
npm run typecheck
npm test
npm run build
node --test --test-concurrency=1 tests/*.test.mjs
npm run test:sites
npm run pack
npm ls @evenrealities/even_hub_sdk
```

Expected: every command exits zero and the installed SDK remains `0.0.11`.

- [ ] **Step 2: Push the experiment branch**

```bash
git push
```

- [ ] **Step 3: Verify the existing isolated server**

Confirm port `4177` is still listening. Vite should hot-reload the same
worktree; start it only if it is no longer active:

```bash
npm run dev -- --host 0.0.0.0 --port 4177 --strictPort
```

- [ ] **Step 4: Verify the physical URL**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&build=pipeline-4-038'
```

Expected: HTTP `200`.

- [ ] **Step 5: Preserve the branch and hand off the physical gate**

Keep `experiment/g2-pipelined-transport` and its worktree. Do not merge into
`main`. Provide the exact pipeline-two and pipeline-four links and state that
four-call speed and stability are unproven until the owner supplies physical
G2 evidence.

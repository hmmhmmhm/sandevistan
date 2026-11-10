# G2 Pipelined Image Transport Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, bounded two- or three-call G2 image pipeline while preserving the serial SDK `0.0.11` default and the existing no-refresh-queue contract.

**Architecture:** Parse `pipeline=1|2|3` once in the application. Pass the literal concurrency value through the HUD controller into the fast Canvas transport. Use a transport-independent bounded runner inside each accepted refresh. Keep image encoding, timeout, unchanged-tile detection, success-only caching, refresh busy-drop, and page rollback behavior unchanged.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Even Hub SDK `0.0.11`, Canvas 2D, Vite 6

---

### Task 1: Resolve the opt-in pipeline value

**Files:**
- Create: `src/image-send-concurrency.ts`
- Create: `src/image-send-concurrency.test.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveImageSendConcurrency } from "./image-send-concurrency";

describe("G2 image send concurrency", () => {
  it.each([
    ["", 1],
    ["?pipeline=1", 1],
    ["?pipeline=2", 2],
    ["?pipeline=3", 3],
    ["?pipeline=0", 1],
    ["?pipeline=4", 1],
    ["?pipeline=two", 1],
  ])("resolves %s to %i", (search, expected) => {
    expect(resolveImageSendConcurrency(search)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/image-send-concurrency.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `image-send-concurrency.ts` does not exist.

- [ ] **Step 3: Implement the literal resolver**

```ts
export type ImageSendConcurrency = 1 | 2 | 3;

export function resolveImageSendConcurrency(
  search: string,
): ImageSendConcurrency {
  const value = new URLSearchParams(search).get("pipeline");
  return value === "2" ? 2 : value === "3" ? 3 : 1;
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run the Step 2 command.

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/image-send-concurrency.ts src/image-send-concurrency.test.ts
git commit -m "feat: resolve G2 image pipeline limit"
```

### Task 2: Add a bounded fail-fast runner

**Files:**
- Create: `src/bounded-task-pool.ts`
- Create: `src/bounded-task-pool.test.ts`

- [ ] **Step 1: Write failing behavioral tests**

Use deferred promises to prove maximum concurrency, ordered starts, immediate
slot reuse, and failure settling:

```ts
import { describe, expect, it, vi } from "vitest";
import { runBounded } from "./bounded-task-pool";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((pass, fail) => {
    resolve = pass;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe("runBounded", () => {
  it("starts in order and fills one freed slot", async () => {
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const starts: number[] = [];
    let active = 0;
    let maximum = 0;
    const running = runBounded(gates, 2, async (gate, index) => {
      starts.push(index);
      active += 1;
      maximum = Math.max(maximum, active);
      await gate.promise;
      active -= 1;
    });

    await vi.waitFor(() => expect(starts).toEqual([0, 1]));
    gates[1].resolve();
    await vi.waitFor(() => expect(starts).toEqual([0, 1, 2]));
    gates[0].resolve();
    gates[2].resolve();
    await vi.waitFor(() => expect(starts).toEqual([0, 1, 2, 3]));
    gates[3].resolve();
    await running;
    expect(maximum).toBe(2);
  });

  it("stops launching after failure and settles active work", async () => {
    const gates = [deferred(), deferred(), deferred()];
    const starts: number[] = [];
    const running = runBounded(gates, 2, async (gate, index) => {
      starts.push(index);
      await gate.promise;
    });

    await vi.waitFor(() => expect(starts).toEqual([0, 1]));
    gates[0].reject(new Error("send failed"));
    await vi.waitFor(() => expect(starts).toEqual([0, 1]));
    let settled = false;
    void running.catch(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    gates[1].resolve();
    await expect(running).rejects.toThrow("send failed");
    expect(starts).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npx vitest run src/bounded-task-pool.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `bounded-task-pool.ts` does not exist.

- [ ] **Step 3: Implement the bounded runner**

```ts
export async function runBounded<T>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const capacity = Math.max(1, Math.floor(limit));
  await new Promise<void>((resolve, reject) => {
    let nextIndex = 0;
    let active = 0;
    let failed = false;
    let firstError: unknown;

    const finishIfReady = () => {
      if (active > 0) return;
      if (failed) reject(firstError);
      else if (nextIndex >= items.length) resolve();
    };
    const launch = () => {
      while (!failed && active < capacity && nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        active += 1;
        void run(items[index], index).then(
          () => {
            active -= 1;
            launch();
            finishIfReady();
          },
          (error: unknown) => {
            active -= 1;
            if (!failed) {
              failed = true;
              firstError = error;
            }
            finishIfReady();
          },
        );
      }
      finishIfReady();
    };
    launch();
  });
}
```

- [ ] **Step 4: Add coverage for limits one and three**

Extend the test with table-driven cases that resolve all active gates in
waves and assert observed maxima `1` and `3`.

- [ ] **Step 5: Run the tests and verify GREEN**

Run the Step 2 command.

Expected: all bounded-runner tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/bounded-task-pool.ts src/bounded-task-pool.test.ts
git commit -m "feat: add bounded fail-fast task runner"
```

### Task 3: Pass the experiment limit to the transport

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/hud-controller-types.ts`
- Modify: `src/fast-hud-controller.ts`
- Modify: `src/fast-canvas-types.ts`
- Modify: `src/fast-canvas-session.ts`

- [ ] **Step 1: Write failing application plumbing tests**

Add `imageSendConcurrency?: 1 | 2 | 3` to `FastTestOptions`, render
`/hud-canvas-fast?pipeline=2`, and assert:

```ts
expect(fastOptions().imageSendConcurrency).toBe(2);
```

Add a second test with `pipeline=9` and assert `1`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npx vitest run src/App.test.tsx src/image-send-concurrency.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: the App test fails because the option is absent.

- [ ] **Step 3: Add explicit option plumbing**

In `App.tsx`, resolve once:

```ts
const imageSendConcurrency = resolveImageSendConcurrency(
  window.location.search,
);
```

Pass it to `useHudController`. Add the field to `UseHudControllerOptions`,
destructure it in `useHudController`, and pass it to `transmitFastCanvas`.

Add this field to `FastCanvasOptions`:

```ts
readonly imageSendConcurrency?: ImageSendConcurrency;
```

Pass the value from `transmitFastCanvas` to `transmitCanvas` as the final
argument, defaulting to `1`.

- [ ] **Step 4: Log the selected mode**

Change the fast transport startup diagnostic to:

```ts
logDiagnostic(
  "APP",
  `transport start · pipeline ${imageSendConcurrency}`,
);
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 2 command.

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/hud-controller-types.ts \
  src/fast-hud-controller.ts src/fast-canvas-types.ts \
  src/fast-canvas-session.ts
git commit -m "feat: route image pipeline experiment setting"
```

### Task 4: Pipeline SDK image calls inside one refresh

**Files:**
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/glasses.test.ts`

- [ ] **Step 1: Extend the transport harness**

Add `imageSendConcurrency?: 1 | 2 | 3` to
`FastRefreshHarnessConfig`. Include the option in the test option type.
Pass the option to `transmitFastCanvas`.

- [ ] **Step 2: Write the failing concurrency-two test**

Hold the first two startup calls with deferred promises. Assert that IDs `3, 5` start and maximum active calls reaches two. ID `2` must start as soon as one slot resolves. ID `4` follows without exceeding two active calls.

Also assert the diagnostic contains:

```text
[TILE] sandevistanTR start · 1/4 · inflight 1/2
[TILE] sandevistanBR start · 2/4 · inflight 2/2
```

- [ ] **Step 3: Write the failing concurrency-three and serial-default tests**

Prove the maximum active calls are three and one respectively, while startup
order remains `[3, 5, 2, 4]`.

- [ ] **Step 4: Run focused transport tests and verify RED**

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "pipeline|concurrency"
```

Expected: the pipelined tests fail because the transport is still serial.

- [ ] **Step 5: Replace the per-refresh sequential runner**

Import `runBounded` and accept
`imageSendConcurrency: ImageSendConcurrency = 1` as the final
`transmitCanvas` argument.

Capture `refreshStartedAt` before encoding so the refresh-complete diagnostic
can report encoding plus all SDK calls as one comparable wall-clock duration.

Replace:

```ts
await sendTilesSequentially(encodedTiles, async (bytes, index) => {
```

with:

```ts
let activeImageSends = 0;
await runBounded(
  encodedTiles,
  imageSendConcurrency,
  async (bytes, index) => {
```

Increment `activeImageSends` immediately before the SDK call.
Log `inflight ${activeImageSends}/${imageSendConcurrency}`. Decrement the count in a
`finally` block around the complete SDK send/result-normalization operation.
Leave unchanged-tile exits before the increment so skips consume no SDK slot.
Pass `diagnosticDuration(refreshStartedAt)` to the existing
`image refresh complete` diagnostic.

- [ ] **Step 6: Verify fail-fast cache semantics**

Add a test where one of the first two calls fails while its peer remains
active. After a failure is observed, assert that no later tile starts. The refresh must wait for its active peer to settle. The next independent refresh skips the successful peer and retries the failed or never-started tile.

- [ ] **Step 7: Run transport tests and verify GREEN**

```bash
npx vitest run src/glasses.test.ts src/bounded-task-pool.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: all transport and runner tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/fast-canvas-transport.ts src/glasses.test.ts
git commit -m "feat: pipeline bounded G2 tile sends"
```

### Task 5: Document and expose the hardware experiment

**Files:**
- Modify: `package.json`
- Create: `docs/hardware/2026-07-30-g2-pipelined-image-transport.md`
- Modify: `src/sdk-version.test.ts`

- [ ] **Step 1: Write a failing metadata test**

Keep the existing stable `qr` assertion and add assertions that the package
scripts contain:

```text
pipeline=2&build=pipeline-2-036
pipeline=3&build=pipeline-3-037
```

Both URLs must retain `sdk=0.0.11`.

- [ ] **Step 2: Run the metadata test and verify RED**

```bash
npx vitest run src/sdk-version.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the experiment scripts do not exist.

- [ ] **Step 3: Add experiment QR scripts**

Add `qr:pipeline2` and `qr:pipeline3` scripts without changing the existing
stable `qr` command.

- [ ] **Step 4: Add the hardware record**

Document:

- branch and commits;
- serial baseline URL;
- pipeline-two URL;
- pipeline-three URL, marked blocked until pipeline two passes;
- exact log and visual checklist from the design;
- empty result fields for owner-supplied physical evidence;
- rollback URL using `pipeline=1`.

- [ ] **Step 5: Run metadata and repository-copy tests**

```bash
npx vitest run src/sdk-version.test.ts --no-file-parallelism --maxWorkers=1
npm run test:repo
```

Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add package.json src/sdk-version.test.ts \
  docs/hardware/2026-07-30-g2-pipelined-image-transport.md
git commit -m "docs: prepare pipelined G2 hardware gate"
```

### Task 6: Run the complete serial verification and serve

**Files:**
- Modify only if a verification failure identifies a scoped defect.

- [ ] **Step 1: Run all gates serially**

```bash
git diff --check
npm run test:repo
npm run typecheck
npm test
npm run build
node --test --test-concurrency=1 tests/*.test.mjs
npm run test:sites
npm run pack
```

Expected: every command exits zero, SDK remains `0.0.11`, and no test file
runs in parallel.

- [ ] **Step 2: Verify package metadata and repository state**

```bash
npm ls @evenrealities/even_hub_sdk
git status --short --branch
```

Expected: SDK `0.0.11`; clean experiment branch.

- [ ] **Step 3: Start one isolated experiment server**

Run one Vite server only:

```bash
npm run dev -- --host 0.0.0.0 --port 4177 --strictPort
```

- [ ] **Step 4: Verify URLs serially**

```bash
curl -I "http://127.0.0.1:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&build=pipeline-baseline-036"
curl -I "http://127.0.0.1:4177/hud-canvas-fast?sdk=0.0.11&pipeline=2&build=pipeline-2-036"
```

Expected: HTTP 200 for both.

- [ ] **Step 5: Push the experiment branch**

```bash
git push -u origin experiment/g2-pipelined-transport
```

- [ ] **Step 6: Hand off the serial physical gate**

Provide the Tailscale baseline and pipeline-two URLs. Do not expose
pipeline-three as the next action until the owner confirms pipeline two passes.

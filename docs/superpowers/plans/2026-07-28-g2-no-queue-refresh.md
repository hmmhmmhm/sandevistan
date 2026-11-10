# G2 No-Queue Refresh Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every deferred G2 refresh and location queue with immediate accept-or-drop execution, prevent timer catch-up storms, and restore COPY on HTTP WebViews.

**Architecture:** A wall-clock minute watcher uses one interval and a minute key. Repeated SDK callbacks cannot create more timers or more than one minute event. The raster transport and location session each expose one `busy` gate. Each request starts immediately or is discarded. Neither component retains a pending target, merge, retry, or latest-value slot. Successful display transfers report their minute to `App`, allowing redundant clock-only refreshes to be skipped.

**Tech Stack:** TypeScript, React 19, Vite 6, Vitest 4, Testing Library, Even Hub SDK 0.0.11.

---

## File Map

- `src/minute-refresh.ts`: one interval, wall-minute de-duplication, no recursive timer creation.
- `src/minute-refresh.test.ts`: timer storm and no-catch-up regression tests.
- `src/fast-canvas-types.ts`: display-commit callback and testable clock option.
- `src/fast-canvas-transport.ts`: one immediate operation gate; no Promise chain or pending refresh target.
- `src/fast-canvas-session.ts`: report the successful transfer minute to the app.
- `src/glasses.test.ts`: prove busy and hidden requests are discarded and never run later.
- `src/App.tsx`: skip minute refresh when another successful transfer already covered the minute.
- `src/App.test.tsx`: successful-minute and failed-attempt behavior.
- `src/live-dashboard.ts`: one location-processing gate with immediate busy drop.
- `src/live-dashboard-refresh.ts`: active provider refreshes reject duplicate calls instead of joining them.
- `src/live-dashboard-map.test.ts`: slow-map location storm regression.
- `src/copy-text.ts`: Clipboard API plus legacy textarea copy fallback.
- `src/copy-text.test.ts`: HTTP WebView fallback behavior.
- `src/DiagnosticConsole.tsx`: show `COPIED` or `COPY FAILED` without a reset timer.
- `src/DiagnosticConsole.test.tsx`: copy-result UI tests.

### Task 1: Replace the Recursive Minute Scheduler

**Files:**
- Modify: `src/minute-refresh.ts`
- Modify: `src/minute-refresh.test.ts`

- [ ] **Step 1: Write failing timer-storm tests**

Add tests that model repeated SDK callbacks at one wall-clock minute:

```ts
it("emits at most once when the SDK repeats a callback in one minute", () => {
  let now = Date.parse("2026-07-28T08:03:00.345Z");
  let tick: (() => void) | undefined;
  const setIntervalImpl = vi.fn((callback: () => void) => {
    tick = callback;
    return 9;
  });
  const onMinute = vi.fn();
  const stop = startMinuteRefresh(onMinute, {
    now: () => now,
    setIntervalImpl,
    clearIntervalImpl: vi.fn(),
  });

  for (let index = 0; index < 20_000; index += 1) tick?.();
  expect(onMinute).not.toHaveBeenCalled();
  expect(setIntervalImpl).toHaveBeenCalledOnce();

  now += 60_000;
  for (let index = 0; index < 20_000; index += 1) tick?.();
  expect(onMinute).toHaveBeenCalledOnce();
  expect(onMinute).toHaveBeenCalledWith(Math.floor(now / 60_000));
  stop();
});

it("does not replay every skipped minute after a wall-clock jump", () => {
  // Advance `now` by ten minutes and invoke the one interval callback.
  // Assert one callback containing only the current minute key.
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/minute-refresh.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: FAIL because the existing recursive scheduler accepts timeout dependencies and repeatedly calls `setTimeout`.

- [ ] **Step 3: Implement one interval with minute-key de-duplication**

Replace recursive scheduling with:

```ts
const MINUTE_POLL_MS = 5_000;
const minuteKey = (time: number) => Math.floor(time / 60_000);

export function startMinuteRefresh(
  onMinute: (minute: number) => void,
  options: MinuteSchedulerOptions = {},
): () => void {
  const now = options.now ?? Date.now;
  const setIntervalImpl = options.setIntervalImpl ?? globalThis.setInterval;
  const clearIntervalImpl = options.clearIntervalImpl
    ?? globalThis.clearInterval;
  let stopped = false;
  let observedMinute = minuteKey(now());
  const timer = setIntervalImpl(() => {
    if (stopped) return;
    const currentMinute = minuteKey(now());
    if (currentMinute === observedMinute) return;
    observedMinute = currentMinute;
    onMinute(currentMinute);
  }, MINUTE_POLL_MS);
  return () => {
    if (stopped) return;
    stopped = true;
    clearIntervalImpl(timer);
  };
}
```

Keep `millisecondsUntilNextMinute` only if another caller still uses it. Otherwise remove it and its obsolete alignment test.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 command. Expected: all minute scheduler tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/minute-refresh.ts src/minute-refresh.test.ts
git commit -m "fix: prevent G2 minute timer catch-up storms"
```

### Task 2: Replace the Raster Operation Queue with an Immediate Busy Gate

**Files:**
- Modify: `src/fast-canvas-types.ts`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/fast-canvas-session.ts`
- Modify: `src/glasses.test.ts`

- [ ] **Step 1: Rewrite queue expectations as failing drop expectations**

Update or replace transport tests with these behaviors:

```ts
it("drops external refreshes received during an active send", async () => {
  const gate = deferred();
  const harness = await createFastRefreshHarness({
    update: async (_id, _call, attempt) => {
      if (attempt === 2) await gate.promise;
      return "success";
    },
  });
  harness.request("right");
  await vi.waitFor(() => expect(harness.maximumActiveImageSends).toBe(1));
  harness.request("left");
  harness.request("all");
  gate.resolve();
  await vi.waitFor(() => expect(harness.imageIds).toHaveLength(6));
  await Promise.resolve();
  expect(harness.encodedTileIds).toEqual([
    [3, 5, 2, 4],
    [3, 5],
  ]);
});

it("drops input received during an active send", async () => {
  // Block the first handled tap transfer, emit another tap, release it,
  // and assert only the first tap was passed to `onInput` and sent.
});

it("drops a hidden external refresh without creating an operation", async () => {
  // Hide, request right, assert no encode and trace contains
  // `external right dropped · hidden`.
});
```

Change the trace assertion from `input tap queued` to `input tap accepted`.

- [ ] **Step 2: Run focused transport tests and verify RED**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "drops external refreshes|drops input received|drops a hidden external|traces one handled tap"
```

Expected: FAIL because `operationQueue`, `pendingRefreshTarget`, and follow-up merging still execute requests later.

- [ ] **Step 3: Add display-commit types**

Extend `FastCanvasOptions`:

```ts
readonly now?: () => number;
readonly onDisplayCommitted?: (minute: number) => void;
```

Pass a final `onDisplayCommitted?: () => void` observer into `transmitCanvas`.
Call it only after all target tiles succeed and immediately after the completion
progress message. In `transmitFastCanvas`, translate that callback into:

```ts
const now = options.now ?? Date.now;
const onDisplayCommitted = () => {
  options.onDisplayCommitted?.(Math.floor(now() / 60_000));
};
```

- [ ] **Step 4: Implement an immediate operation gate**

Delete `operationQueue`, `pendingOperationCount`, `pendingRefreshTarget`,
`externalRefreshScheduled`, target merge rules, and rescheduling.

Use one gate:

```ts
let busy = false;
const startOperation = (
  label: string,
  operation: () => void | Promise<void>,
): boolean => {
  if (disposed || busy) {
    logDiagnostic("REFRESH", `${label} dropped · ${
      disposed ? "disposed" : "busy"
    }`);
    return false;
  }
  busy = true;
  logDiagnostic("REFRESH", `${label} accepted`);
  const startedAt = diagnosticNow();
  void (async () => operation())()
    .catch((error: unknown) => {
      logDiagnostic("ERROR", `${label} failed · ${diagnosticError(error)}`);
      onProgress(diagnosticError(error));
    })
    .finally(() => {
      busy = false;
      logDiagnostic(
        "REFRESH",
        `${label} complete`,
        diagnosticDuration(startedAt),
      );
    });
  return true;
};
```

For external refresh, test `disposed`, `hidden`, and `busy` synchronously.
Start exactly the requested target when idle. Do not store the target.
For input, reject while busy; allow a hidden double-tap only when idle.

- [ ] **Step 5: Run transport regression tests and verify GREEN**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: all raster, input, battery, hidden, and display-commit tests PASS.

- [ ] **Step 6: Check the transport boundary and commit**

Run:

```bash
npx vitest run src/transport-boundaries.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: `fast-canvas-transport.ts` remains at or below 450 lines.

Commit:

```bash
git add src/fast-canvas-types.ts src/fast-canvas-transport.ts src/fast-canvas-session.ts src/glasses.test.ts
git commit -m "fix: drop busy G2 refresh requests"
```

### Task 3: Skip Redundant Minute Refreshes in App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing successful-minute tests**

Extend `FastTestOptions` with `onDisplayCommitted`. Add:

```ts
it("skips clock refresh when another transfer already committed this minute", async () => {
  // Start fast HUD and capture `onMinute`.
  fastOptions().onDisplayCommitted?.(1234);
  onMinute?.(1234);
  expect(requestRefresh).not.toHaveBeenCalledWith("right-top");

  onMinute?.(1235);
  expect(requestRefresh).toHaveBeenCalledWith("right-top");
});

it("does not retry a rejected minute refresh in the same minute", async () => {
  // Invoke the minute callback repeatedly with the same key.
  // The scheduler contract and App together must produce one request.
});
```

- [ ] **Step 2: Run focused App tests and verify RED**

Run:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "skips clock refresh|does not retry a rejected"
```

Expected: FAIL because App does not track successful display minutes and the old callback has no minute key.

- [ ] **Step 3: Implement successful-minute tracking**

Inside the fast HUD effect:

```ts
let lastSuccessfulDisplayMinute: number | undefined;
let lastMinuteAttempt: number | undefined;
```

Pass:

```ts
onDisplayCommitted: (minute) => {
  lastSuccessfulDisplayMinute = minute;
  logDiagnostic("REFRESH", `display committed · minute ${minute}`);
},
```

Use the minute callback:

```ts
(minute) => {
  if (lastMinuteAttempt === minute) return;
  lastMinuteAttempt = minute;
  if (lastSuccessfulDisplayMinute === minute) {
    logDiagnostic("TIMER", "minute refresh skipped · already rendered");
    return;
  }
  logDiagnostic("TIMER", `minute refresh · mode ${view.mode}`);
  if (view.mode === "dashboard") requestVisibleRefresh("right-top");
}
```

Do not schedule a second attempt after busy, hidden, or failed outcomes.

- [ ] **Step 4: Run all App tests and commit**

Run:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: all App tests PASS.

Commit:

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "fix: skip redundant G2 clock refreshes"
```

### Task 4: Remove the Location Promise Queue

**Files:**
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard-refresh.ts`
- Modify: `src/live-dashboard-map.test.ts`

- [ ] **Step 1: Write a failing slow-map location-storm test**

Add a test that starts one map refresh from a moved coordinate. While the refresh is unresolved, emit two more locations. Verify that the session does not process those locations later:

```ts
it("drops locations received while a slow map refresh is active", async () => {
  // Start session with a StreamingBridge and a deferred second map response.
  bridge.emit(firstMovedLocation);
  await vi.waitFor(() => expect(secondMapRequestStarted).toBe(true));
  bridge.emit(droppedLocationOne);
  bridge.emit(droppedLocationTwo);
  map.resolve(mapResponse("new-cell"));
  await vi.waitFor(() => expect(trace).toContain("busy drop"));
  expect(session.getState().location.value?.coordinate)
    .toEqual(firstMovedCoordinate);

  bridge.emit(futureLocation);
  await vi.waitFor(() => {
    expect(session.getState().location.value?.coordinate)
      .toEqual(futureCoordinate);
  });
});
```

Assert the dropped coordinates were not persisted and the trace never reports a
pending count.

- [ ] **Step 2: Run the focused location test and verify RED**

Run:

```bash
npx vitest run src/live-dashboard-map.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "drops locations received"
```

Expected: FAIL because `locationQueue` processes every event after the slow map finishes.

- [ ] **Step 3: Implement immediate location accept-or-drop**

Delete `locationQueue` and `pendingLocationCount`. Use:

```ts
let locationBusy = false;
const queueLocation = (location: AppLocation) => {
  locationEventCount += 1;
  const eventId = locationEventCount;
  if (disposed || locationBusy) {
    logDiagnostic(
      "LOCATION",
      `raw #${eventId} busy drop · ${disposed ? "disposed" : "active"}`,
    );
    return;
  }
  locationBusy = true;
  logDiagnostic("LOCATION", `raw #${eventId} accepted`);
  void processLocation(location, eventId)
    .catch((error: unknown) => {
      logDiagnostic(
        "ERROR",
        `location process #${eventId} failed · ${diagnosticErrorKind(error)}`,
      );
    })
    .finally(() => {
      locationBusy = false;
      logDiagnostic("LOCATION", `process #${eventId} complete`);
    });
};
```

Move the existing normalization, movement, persistence, map, and route logic into
`processLocation`. Do not retain a dropped `AppLocation`.

For weather, news, and map refresh functions, replace:

```ts
if (mapPromise) return mapPromise;
```

with:

```ts
if (mapPromise) {
  logDiagnostic("LIVE", "map dropped · busy");
  return Promise.resolve();
}
```

Apply the same rule to weather and news.

- [ ] **Step 4: Run live-data tests and verify GREEN**

Run:

```bash
npx vitest run src/live-cache.test.ts src/live-dashboard.test.ts src/live-dashboard-map.test.ts src/live-dashboard-route.test.ts src/live-dashboard-todo.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: all live session tests PASS with no queued or pending-count assertion.

- [ ] **Step 5: Commit**

```bash
git add src/live-dashboard.ts src/live-dashboard-refresh.ts src/live-dashboard-map.test.ts
git commit -m "fix: drop busy G2 location updates"
```

### Task 5: Restore COPY on HTTP WebViews

**Files:**
- Create: `src/copy-text.ts`
- Create: `src/copy-text.test.ts`
- Modify: `src/DiagnosticConsole.tsx`
- Modify: `src/DiagnosticConsole.test.tsx`

- [ ] **Step 1: Write failing Clipboard fallback tests**

Add:

```ts
it("falls back to a selected textarea when Clipboard API is unavailable", async () => {
  const execCommand = vi.fn(() => true);
  const copied = await copyText("trace", {
    document: Object.assign(document, { execCommand }),
  });
  expect(copied).toBe(true);
  expect(execCommand).toHaveBeenCalledWith("copy");
  expect(document.querySelector("textarea")).toBeNull();
});

it("falls back after Clipboard API rejects", async () => {
  const clipboard = { writeText: vi.fn(async () => {
    throw new Error("not allowed");
  }) };
  const execCommand = vi.fn(() => true);
  expect(await copyText("trace", {
    clipboard,
    document: Object.assign(document, { execCommand }),
  })).toBe(true);
});
```

Add a component test that expects the button label to become `COPIED` or
`COPY FAILED`.

- [ ] **Step 2: Run copy tests and verify RED**

Run:

```bash
npx vitest run src/copy-text.test.ts src/DiagnosticConsole.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: FAIL because `copyText` does not exist and the button has no result state.

- [ ] **Step 3: Implement the fallback without timers**

Create:

```ts
type CopyDocument = Pick<Document, "body" | "createElement"> & {
  execCommand?: (command: string) => boolean;
};

export async function copyText(
  text: string,
  options: {
    clipboard?: Pick<Clipboard, "writeText">;
    document?: CopyDocument;
  } = {},
): Promise<boolean> {
  if (options.clipboard) {
    try {
      await options.clipboard.writeText(text);
      return true;
    } catch {
      // Continue to the synchronous WebView fallback.
    }
  }
  const target = options.document ?? document;
  const textarea = target.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  target.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return target.execCommand?.("copy") === true;
  } finally {
    textarea.remove();
  }
}
```

In `DiagnosticConsole`, pass `navigator.clipboard` only when present, set a
`copyResult` state, and render `COPY`, `COPIED`, or `COPY FAILED`. Do not use a
timeout to reset the label.

- [ ] **Step 4: Run copy and component tests and verify GREEN**

Run the Task 5 test command. Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/copy-text.ts src/copy-text.test.ts src/DiagnosticConsole.tsx src/DiagnosticConsole.test.tsx
git commit -m "fix: copy WebView trace over HTTP"
```

### Task 6: Full Serial Verification and Physical-Test Server

**Files:**
- Verify only; update source only if a regression exposes a defect.

- [ ] **Step 1: Run type checking**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Run all tests serially**

```bash
npm test -- --testTimeout=30000
```

Expected: every file passes with `--no-file-parallelism --maxWorkers=1`.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: Vite build and Sites preparation complete successfully.

- [ ] **Step 4: Check source boundaries and worktree**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and no uncommitted implementation files.

- [ ] **Step 5: Verify the existing Tailscale server**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=no-queue-024'
```

Expected: `200`.

- [ ] **Step 6: Stop before push for physical glasses verification**

Test in this order:

1. Clear the trace.
2. Leave the visible HUD idle across at least two minute boundaries.
3. Hide the HUD and leave it idle for the same duration.
4. Restore once and verify one full render.
5. Move with navigation inactive and verify location logs never show pending work.
6. Press COPY and verify `COPIED`.

Do not push until the physical G2 gate passes.

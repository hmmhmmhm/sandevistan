# G2 Hidden Input Diagnostic Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show raw hidden-state Even Hub input on the phone so one physical double tap identifies whether the event channel or the input normalizer fails.

**Architecture:** Add a read-only diagnostic snapshot at the fast Canvas transport boundary before hidden-state filtering. Pass it through the existing fast Canvas options and render it only as the React companion status. Do not draw, encode, or send another glasses frame.

**Tech Stack:** TypeScript, React 19, Even Hub SDK 0.0.11, Vitest, Testing Library, Vite

---

### Task 1: Checkpoint the physically verified single-tap normalization

**Files:**
- Modify: `src/fast-canvas-transport.ts:288-302`
- Test: `src/glasses.test.ts:160-175`
- Test: `src/glasses.test.ts:985-1003`

- [ ] **Step 1: Run the focused single-tap regression test**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "treats a text event with an omitted zero event type as a tap"
```

Expected: PASS, proving the already physically verified change remains covered.

- [ ] **Step 2: Commit only the verified single-tap files**

```bash
git add src/fast-canvas-transport.ts src/glasses.test.ts
git commit -m "fix: recognize omitted G2 single tap type"
```

Expected: the diagnostic work starts from a clean source tree while the design
and plan commits remain separate.

### Task 2: Expose hidden-state raw event diagnostics

**Files:**
- Modify: `src/fast-canvas-transport.ts:67-89`
- Modify: `src/fast-canvas-transport.ts:288-304`
- Test: `src/glasses.test.ts:20-44`
- Test: `src/glasses.test.ts:50-177`
- Test: `src/glasses.test.ts:985-1020`

- [ ] **Step 1: Write the failing transport test**

Extend the harness options with the production diagnostic type and capture every
snapshot:

```ts
type TestRawEvent = {
  readonly count: number;
  readonly hidden: boolean;
  readonly sysEventType?: OsEventTypeList;
  readonly textEventType?: OsEventTypeList;
  readonly eventSource?: number;
};

const rawEvents: TestRawEvent[] = [];
```

Pass `onRawEvent: (event) => rawEvents.push(event)` to
`transmitFastCanvas()` and return `rawEvents` plus `emitEvent` from the harness.
Add this regression:

```ts
it("reports an omitted hidden event before discarding it", async () => {
  const harness = await createFastRefreshHarness();

  harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
  await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));

  harness.emitEvent({
    textEvent: {
      containerID: 1,
      containerName: "eventLayer",
    },
  });
  await Promise.resolve();
  await Promise.resolve();

  expect(harness.rawEvents.at(-1)).toEqual({
    count: 2,
    hidden: true,
    sysEventType: undefined,
    textEventType: undefined,
    eventSource: undefined,
  });
  expect(harness.imageIds).toHaveLength(8);

  harness.cleanup();
  harness.emitEvent({
    sysEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT },
  });
  expect(harness.rawEvents).toHaveLength(2);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "reports an omitted hidden event before discarding it"
```

Expected: FAIL because `onRawEvent` and `rawEvents` do not yet exist.

- [ ] **Step 3: Add the minimal transport snapshot**

Export the type and option:

```ts
export type FastCanvasRawEvent = {
  readonly count: number;
  readonly hidden: boolean;
  readonly sysEventType?: OsEventTypeList;
  readonly textEventType?: OsEventTypeList;
  readonly eventSource?: number;
};

export type FastCanvasOptions = {
  // existing fields
  readonly onRawEvent?: (event: FastCanvasRawEvent) => void;
};
```

Thread `onRawEvent` into `transmitCanvas()`. Immediately after the existing
`disposed` guard in the Even Hub listener, capture without normalization:

```ts
eventCount += 1;
try {
  onRawEvent?.(Object.freeze({
    count: eventCount,
    hidden,
    sysEventType: event.sysEvent?.eventType,
    textEventType: event.textEvent?.eventType,
    eventSource: event.sysEvent?.eventSource,
  }));
} catch {
  // Phone-only diagnostics must not break glasses input.
}
```

Pass `options.onRawEvent` from `transmitFastCanvas()` into `transmitCanvas()`.

- [ ] **Step 4: Run the focused transport tests and verify GREEN**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "reports an omitted hidden event before discarding it|treats a text event with an omitted zero event type as a tap"
```

Expected: both tests PASS and hidden diagnostics send no extra image.

- [ ] **Step 5: Commit the transport diagnostic**

```bash
git add src/fast-canvas-transport.ts src/glasses.test.ts
git commit -m "feat: expose hidden G2 input diagnostics"
```

### Task 3: Show the diagnostic on the phone companion

**Files:**
- Modify: `src/App.tsx:165-207`
- Test: `src/App.test.tsx:15-33`
- Test: `src/App.test.tsx:230-310`

- [ ] **Step 1: Write the failing companion test**

Add `onRawEvent` to `FastTestOptions`, then add:

```ts
it("shows raw hidden input only in the phone status", async () => {
  window.history.replaceState({}, "", "/hud-canvas-fast");
  mocks.transmitFast.mockImplementation(async () => vi.fn());
  mocks.waitForBridge.mockResolvedValue({});
  mocks.createSession.mockReturnValue({
    start: vi.fn(async () => undefined),
    getState: vi.fn(),
    dispose: vi.fn(),
  });

  render(<App />);
  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());

  fastOptions().onRawEvent?.({
    count: 7,
    hidden: true,
    sysEventType: undefined,
    textEventType: OsEventTypeList.DOUBLE_CLICK_EVENT,
    eventSource: 2,
  });

  expect(screen.getByText(
    "Hidden input #7 · SYS - · TEXT 3 · SRC 2",
  )).toBeTruthy();
});
```

Import `OsEventTypeList` in the test.

- [ ] **Step 2: Run the companion test and verify RED**

Run:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "shows raw hidden input only in the phone status"
```

Expected: FAIL because the app does not pass or format raw event diagnostics.

- [ ] **Step 3: Implement phone-only status formatting**

Pass this option to `transmitFastCanvas()`:

```ts
onRawEvent: (event) => {
  if (!event.hidden) return;
  const field = (value: number | undefined) => value ?? "-";
  report(
    `Hidden input #${event.count}`
      + ` · SYS ${field(event.sysEventType)}`
      + ` · TEXT ${field(event.textEventType)}`
      + ` · SRC ${field(event.eventSource)}`,
  );
},
```

Do not invoke `drawCurrentPage`, `requestVisibleRefresh`, or any bridge method.

- [ ] **Step 4: Run the companion and transport tests**

Run serially:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "shows raw hidden input only in the phone status"
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "reports an omitted hidden event before discarding it"
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the companion diagnostic**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: show hidden G2 input diagnostics"
```

### Task 4: Verify and serve the physical diagnostic

**Files:**
- Verify: `src/fast-canvas-transport.ts`
- Verify: `src/App.tsx`
- Verify: `src/glasses.test.ts`
- Verify: `src/App.test.tsx`

- [ ] **Step 1: Run static verification**

Run serially:

```bash
npm run typecheck
npm run build
```

Expected: both exit successfully.

- [ ] **Step 2: Run the focused test files**

Run:

```bash
npx vitest run src/glasses.test.ts src/App.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: both files PASS with no failed tests.

- [ ] **Step 3: Verify the existing single development server**

```bash
ps -p 89680 -o pid=,command=
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=hidden-input-diagnostic-021'
```

Expected: PID 89680 is the only Vite server for this worktree and the URL
returns `200`.

- [ ] **Step 4: Stop at the physical gate**

Refresh the URL, hide the HUD, double tap once, and inspect the phone status:

- unchanged `HUD display complete` means the event channel stalled;
- `Hidden input...` means the raw fields identify the normalizer/routing defect;
- a normal restore means the diagnostic build changed timing and the bounded
  queue remains the next reproducible stress test.

Do not push or mark the project complete before this physical result.

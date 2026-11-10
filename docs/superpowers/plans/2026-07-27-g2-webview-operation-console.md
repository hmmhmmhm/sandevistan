# G2 WebView Operation Console Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded, timestamped phone-WebView console that reveals the last input, location, storage, refresh, encoding, tile, timer, or error boundary before the WebView freezes.

**Architecture:** A dependency-free global diagnostic logger retains only 300 formatted entries. A separate React component polls the logger version every 250ms and renders one text node. Existing app, transport, location, cache, and live-refresh boundaries append payload-free structured entries.

**Tech Stack:** TypeScript, React 19, Even Hub SDK 0.0.11, Vitest, Testing Library, Vite

---

### Task 1: Build the bounded diagnostic logger and heartbeat

**Files:**
- Create: `src/diagnostic-log.ts`
- Test: `src/diagnostic-log.test.ts`

- [ ] **Step 1: Write failing logger tests**

Create `src/diagnostic-log.test.ts` with tests for timestamp formatting,
capacity, clear, and heartbeat drift:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  createDiagnosticLogger,
  startDiagnosticHeartbeat,
} from "./diagnostic-log";

describe("diagnostic log", () => {
  it("formats timestamped entries and keeps only the newest capacity", () => {
    const times = [
      new Date("2026-07-27T22:31:08.427+09:00"),
      new Date("2026-07-27T22:31:09.004+09:00"),
      new Date("2026-07-27T22:31:10.111+09:00"),
    ];
    const logger = createDiagnosticLogger({
      capacity: 2,
      now: () => times.shift()!,
    });

    logger.append("APP", "first");
    logger.append("TILE", "second", 18);
    logger.append("ERROR", "third");

    expect(logger.snapshot()).toMatchObject({
      dropped: 1,
      entries: [
        { sequence: 2, timestamp: "22:31:09.004", category: "TILE" },
        { sequence: 3, timestamp: "22:31:10.111", category: "ERROR" },
      ],
    });
    expect(logger.text()).toContain(
      "[22:31:09.004] #0002 [TILE] second · 18ms",
    );
  });

  it("clears retained and dropped entries without reusing sequence numbers", () => {
    const logger = createDiagnosticLogger({ capacity: 1 });
    logger.append("APP", "one");
    logger.append("APP", "two");
    logger.clear();
    logger.append("APP", "three");

    expect(logger.snapshot()).toMatchObject({
      dropped: 0,
      entries: [{ sequence: 3, message: "three" }],
    });
  });

  it("reports heartbeat drift and stops its timer", () => {
    vi.useFakeTimers();
    let now = 1_000;
    const logger = createDiagnosticLogger();
    const stop = startDiagnosticHeartbeat(logger, {
      intervalMs: 5_000,
      now: () => now,
    });

    now = 6_125;
    vi.advanceTimersByTime(5_000);
    expect(logger.text()).toContain("heartbeat · drift 125ms");

    stop();
    now = 11_125;
    vi.advanceTimersByTime(5_000);
    expect(logger.snapshot().entries).toHaveLength(1);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the logger test and verify RED**

Run:

```bash
npx vitest run src/diagnostic-log.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: FAIL because `diagnostic-log.ts` does not exist.

- [ ] **Step 3: Implement the minimal bounded logger**

Create `src/diagnostic-log.ts` with:

```ts
export type DiagnosticCategory =
  | "APP" | "INPUT" | "LOCATION" | "STORAGE" | "LIVE"
  | "REFRESH" | "ENCODE" | "TILE" | "TIMER" | "ERROR";

export type DiagnosticEntry = {
  readonly sequence: number;
  readonly timestamp: string;
  readonly category: DiagnosticCategory;
  readonly message: string;
  readonly durationMs?: number;
};

type LoggerOptions = {
  readonly capacity?: number;
  readonly now?: () => Date;
};

const timestamp = (date: Date) => {
  const part = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${part(date.getHours())}:${part(date.getMinutes())}:`
    + `${part(date.getSeconds())}.${part(date.getMilliseconds(), 3)}`;
};

export function createDiagnosticLogger(options: LoggerOptions = {}) {
  const capacity = Math.max(1, Math.floor(options.capacity ?? 300));
  const now = options.now ?? (() => new Date());
  let entries: DiagnosticEntry[] = [];
  let sequence = 0;
  let dropped = 0;
  let version = 0;

  const snapshot = () => ({
    version,
    dropped,
    capacity,
    entries: entries.map((entry) => ({ ...entry })),
  });
  const text = () => entries.map((entry) => (
    `[${entry.timestamp}] #${String(entry.sequence).padStart(4, "0")}`
      + ` [${entry.category}] ${entry.message}`
      + (entry.durationMs === undefined ? "" : ` · ${entry.durationMs}ms`)
  )).join("\n");

  return {
    append(
      category: DiagnosticCategory,
      message: string,
      durationMs?: number,
    ) {
      sequence += 1;
      entries.push({
        sequence,
        timestamp: timestamp(now()),
        category,
        message,
        ...(durationMs === undefined
          ? {}
          : { durationMs: Math.max(0, Math.round(durationMs)) }),
      });
      if (entries.length > capacity) {
        entries = entries.slice(entries.length - capacity);
        dropped += 1;
      }
      version += 1;
    },
    clear() {
      entries = [];
      dropped = 0;
      version += 1;
    },
    snapshot,
    text,
    version: () => version,
  };
}

export type DiagnosticLogger = ReturnType<typeof createDiagnosticLogger>;
export const diagnosticLogger = createDiagnosticLogger();
export const logDiagnostic = diagnosticLogger.append;

type HeartbeatOptions = {
  readonly intervalMs?: number;
  readonly now?: () => number;
};

export function startDiagnosticHeartbeat(
  logger: DiagnosticLogger = diagnosticLogger,
  options: HeartbeatOptions = {},
) {
  const intervalMs = options.intervalMs ?? 5_000;
  const now = options.now ?? Date.now;
  let expected = now() + intervalMs;
  const timer = globalThis.setInterval(() => {
    const current = now();
    const drift = Math.max(0, Math.round(current - expected));
    logger.append("TIMER", `heartbeat · drift ${drift}ms`);
    expected = current + intervalMs;
  }, intervalMs);
  return () => globalThis.clearInterval(timer);
}
```

- [ ] **Step 4: Run the logger tests and verify GREEN**

Run the command from Step 2.

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the logger**

```bash
git add src/diagnostic-log.ts src/diagnostic-log.test.ts
git commit -m "feat: add bounded WebView diagnostic log"
```

### Task 2: Render the phone-only console

**Files:**
- Create: `src/DiagnosticConsole.tsx`
- Create: `src/DiagnosticConsole.test.tsx`
- Modify: `src/App.tsx:337-430`
- Modify: `src/App.test.tsx:140-225`
- Modify: `src/styles.css:83-185`

- [ ] **Step 1: Write failing component tests**

Create `src/DiagnosticConsole.test.tsx` using an injected logger and clipboard:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiagnosticLogger } from "./diagnostic-log";
import { DiagnosticConsole } from "./DiagnosticConsole";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DiagnosticConsole", () => {
  it("batches updates at 250ms and renders one log text block", () => {
    vi.useFakeTimers();
    const logger = createDiagnosticLogger();
    render(<DiagnosticConsole logger={logger} />);
    logger.append("APP", "mounted");

    act(() => vi.advanceTimersByTime(249));
    expect(screen.queryByText(/mounted/)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("diagnostic-lines").textContent)
      .toContain("[APP] mounted");
    expect(document.querySelectorAll(".diagnostic-console pre")).toHaveLength(1);
  });

  it("copies the bounded snapshot and clears visible entries", async () => {
    vi.useFakeTimers();
    const logger = createDiagnosticLogger();
    const writeText = vi.fn(async () => undefined);
    render(
      <DiagnosticConsole
        logger={logger}
        clipboard={{ writeText }}
      />,
    );
    logger.append("LOCATION", "raw callback #1");
    act(() => vi.advanceTimersByTime(250));

    fireEvent.click(screen.getByRole("button", { name: "COPY" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("[LOCATION] raw callback #1"),
    ));
    fireEvent.click(screen.getByRole("button", { name: "CLEAR" }));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByTestId("diagnostic-lines").textContent).toBe("");
  });
});
```

Add an App test proving `WEBVIEW TRACE` appears on `/hud-canvas-fast` and not
on `/hud-canvas`.

- [ ] **Step 2: Run the component tests and verify RED**

Run serially:

```bash
npx vitest run src/DiagnosticConsole.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "shows the diagnostic console only on the fast HUD"
```

Expected: FAIL because the component and App integration do not exist.

- [ ] **Step 3: Implement the console component**

Create `src/DiagnosticConsole.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import {
  diagnosticLogger,
  type DiagnosticLogger,
} from "./diagnostic-log";

type Props = {
  readonly logger?: DiagnosticLogger;
  readonly clipboard?: Pick<Clipboard, "writeText">;
};

export function DiagnosticConsole({
  logger = diagnosticLogger,
  clipboard = navigator.clipboard,
}: Props) {
  const [snapshot, setSnapshot] = useState(logger.snapshot());
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let seen = logger.version();
    const timer = globalThis.setInterval(() => {
      const next = logger.version();
      if (next === seen) return;
      seen = next;
      setSnapshot(logger.snapshot());
    }, 250);
    return () => globalThis.clearInterval(timer);
  }, [logger]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [snapshot.version]);

  const copy = async () => {
    try {
      await clipboard?.writeText(logger.text());
    } catch (error) {
      logger.append(
        "ERROR",
        `clipboard ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const clear = () => {
    logger.clear();
    setSnapshot(logger.snapshot());
  };

  return (
    <section className="diagnostic-console" aria-label="Webview Task Console">
      <header>
        <strong>WEBVIEW TRACE</strong>
        <span>
          {snapshot.entries.length}/{snapshot.capacity}
          {" · "}DROPPED {snapshot.dropped}
        </span>
        <div>
          <button type="button" onClick={() => void copy()}>COPY</button>
          <button type="button" onClick={clear}>CLEAR</button>
        </div>
      </header>
      <pre ref={outputRef} data-testid="diagnostic-lines">
        {logger.text()}
      </pre>
    </section>
  );
}
```

Render `<DiagnosticConsole />` in `App.tsx` only when `fastCanvasHudMode` is
true. Add CSS for a 240px scrollable panel, one text node, square green controls,
and mobile header wrapping.

- [ ] **Step 4: Run the component and App tests and verify GREEN**

Run the two commands from Step 2.

Expected: component tests and the focused App test PASS.

- [ ] **Step 5: Commit the phone console**

```bash
git add src/DiagnosticConsole.tsx src/DiagnosticConsole.test.tsx \
  src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: show bounded WebView operation console"
```

### Task 3: Instrument the raster transport

**Files:**
- Modify: `src/fast-canvas-transport.ts:116-334`
- Test: `src/glasses.test.ts:50-190`
- Test: `src/glasses.test.ts:950-1080`

- [ ] **Step 1: Write the failing transport trace test**

Import the global logger. Clear the logger. Perform one redraw and one hide. Assert that the log contains raw input, queue, encode, tile, and hide boundaries:

```ts
it("traces raster work without sending a diagnostic frame", async () => {
  diagnosticLogger.clear();
  const harness = await createFastRefreshHarness({ inputResult: "redraw" });
  const initialImages = harness.imageIds.length;

  harness.emit(OsEventTypeList.CLICK_EVENT);
  await vi.waitFor(() => expect(harness.imageIds).toHaveLength(initialImages + 4));
  harness.setInputResult("unhandled");
  harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
  await vi.waitFor(() => expect(harness.imageIds).toHaveLength(initialImages + 8));

  const trace = diagnosticLogger.text();
  expect(trace).toContain("[INPUT] raw");
  expect(trace).toContain("[REFRESH] input tap queued");
  expect(trace).toContain("[ENCODE] start · 4 tiles");
  expect(trace).toContain("[TILE] relicTR success");
  expect(trace).toContain("[REFRESH] hide complete");
  expect(harness.imageIds).toHaveLength(initialImages + 8);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "traces raster work without sending a diagnostic frame"
```

Expected: FAIL because no transport trace exists.

- [ ] **Step 3: Add transport boundary logs**

Import `logDiagnostic`. Add a monotonic operation ID, pending operation count,
and a local elapsed clock. Record:

- `ENCODE start/complete/error`;
- `TILE <name> start/success/failure`;
- `REFRESH <label> queued/start/complete/error`;
- hide/restore start and complete;
- external request and merged pending target;
- `INPUT raw` with raw sys/text/source and hidden state.

Do not include `imageData` or encoded byte lengths. Logging calls must not add a
bridge call or invoke `refreshImages`.

- [ ] **Step 4: Run focused transport tests and verify GREEN**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "traces raster work without sending a diagnostic frame|reports an omitted hidden event before discarding it|serializes rapid handled input redraws"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit transport tracing**

```bash
git add src/fast-canvas-transport.ts src/glasses.test.ts
git commit -m "feat: trace G2 raster transport operations"
```

### Task 4: Instrument storage, live providers, and location callbacks

**Files:**
- Modify: `src/live-cache.ts`
- Modify: `src/live-dashboard-refresh.ts`
- Modify: `src/live-dashboard.ts:77-360`
- Test: `src/live-cache.test.ts`
- Test: `src/live-dashboard-map.test.ts`

- [ ] **Step 1: Write failing storage and location trace tests**

Add one cache test asserting `STORAGE read`, `STORAGE write`, and completion
lines for a sanitized key. Add one live map test that emits a below-threshold
fix and a meaningful fix, then asserts:

```ts
const trace = diagnosticLogger.text();
expect(trace).toContain("[LOCATION] raw #1");
expect(trace).toContain("[LOCATION] ignored");
expect(trace).toContain("[LOCATION] raw #2");
expect(trace).toContain("[LOCATION] accepted");
expect(trace).toContain("[STORAGE] location persist start");
```

The test must assert that neither latitude nor longitude string appears in the
trace.

- [ ] **Step 2: Run the tests and verify RED**

Run serially:

```bash
npx vitest run src/live-cache.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "traces cache operations without values"
npx vitest run src/live-dashboard-map.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "traces rejected and accepted location callbacks"
```

Expected: both FAIL because the boundaries are not logged.

- [ ] **Step 3: Add payload-free storage and live tracing**

In `live-cache.ts`, record read/write/clear start, result, error, and duration
using only the normalized cache key.

In `live-dashboard.ts`, keep a raw location counter and record:

- raw callback with accuracy/speed availability;
- queue processing;
- invalid or below-threshold rejection with rounded movement/threshold;
- accepted movement and refresh target;
- persistence start and completion.

In `live-dashboard-refresh.ts`, record weather/news/map start, outcome, and
emitted target without response bodies.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run both commands from Step 2 plus:

```bash
npx vitest run src/live-dashboard.test.ts src/live-dashboard-map.test.ts \
  src/live-cache.test.ts --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: all three files PASS.

- [ ] **Step 5: Commit live tracing**

```bash
git add src/live-cache.ts src/live-dashboard-refresh.ts src/live-dashboard.ts \
  src/live-cache.test.ts src/live-dashboard-map.test.ts
git commit -m "feat: trace live data and location operations"
```

### Task 5: Instrument app lifecycle, timers, and global errors

**Files:**
- Modify: `src/App.tsx:85-305`
- Test: `src/App.test.tsx:230-360`

- [ ] **Step 1: Write the failing app diagnostic test**

Use fake timers and captured fast options to verify:

- fast HUD start;
- minute callback;
- battery callback;
- live update target;
- input transition;
- heartbeat after five seconds;
- `window.error`;
- cleanup prevents later heartbeat entries.

Assert the trace contains `APP`, `TIMER`, `LIVE`, `INPUT`, and `ERROR` without
causing `requestLiveRefresh` beyond the calls already expected by the existing
behavior tests.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000 -t "traces fast HUD lifecycle without changing refresh behavior"
```

Expected: FAIL because App does not start the heartbeat or record these
boundaries.

- [ ] **Step 3: Add lifecycle and error tracing**

Import `logDiagnostic` and `startDiagnosticHeartbeat`. In the fast HUD effect:

- record effect start and cleanup;
- start the heartbeat;
- register `error` and `unhandledrejection` listeners;
- record bridge wait/ready, live session start/ready, minute callback, battery
  change, input transition, and live snapshot target;
- stop heartbeat and remove both listeners during cleanup.

Messages must contain only operation state, page/mode, target, and sanitized
error text.

- [ ] **Step 4: Run focused App tests and verify GREEN**

Run:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1 --testTimeout=30000
```

Expected: the complete App test file PASS.

- [ ] **Step 5: Commit app tracing**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: trace WebView lifecycle and timers"
```

### Task 6: Verify and serve the physical console

**Files:**
- Verify: all files modified in Tasks 1-5

- [ ] **Step 1: Run static verification**

Run serially:

```bash
npm run typecheck
npm run build
```

Expected: both commands succeed.

- [ ] **Step 2: Run the full serial suite**

Run:

```bash
npm test -- --testTimeout=30000
```

Expected: all test files and tests PASS.

- [ ] **Step 3: Verify the existing development server**

Run:

```bash
ps -p 89680 -o pid=,command=
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=webview-trace-022'
curl -fsS 'http://100.96.68.73:4176/src/App.tsx' \
  | rg "DiagnosticConsole"
```

Expected: the single existing Vite process is alive, the URL returns `200`, and
the served module contains the console.

- [ ] **Step 4: Stop at the physical evidence gate**

Refresh the URL, leave the app idle, and record the last 10-20 console lines
when slowdown begins. Do not push or claim the freeze is fixed; this build
measures the cause.

# G2 Live Refresh Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advance the G2 clock every minute. Follow meaningful movement on the map and refresh a changed device battery. Preserve the proven serialized Canvas transport.

**Architecture:** Add a drift-free minute scheduler and one new `right-top` transport target for image ID 3. Subscribe to official device-status and continuous-location SDK events. Normalize and deduplicate events before requesting the existing serialized image queue. Reduce the OSM cache cell to the approved walking refresh distance. On failure, preserve the last valid map.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Even Hub SDK 0.0.11, Canvas, Vite, Node test runner

**Execution:** Inline in the current session. The user explicitly requested no subagents.

---

### Task 1: Add a minute-aligned clock trigger and top-right transport target

**Files:**
- Create: `src/minute-refresh.ts`
- Create: `src/minute-refresh.test.ts`
- Modify: `src/g2-canvas.ts`
- Modify: `src/glasses.ts`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/glasses.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [x] **Step 1: Write the failing minute scheduler tests**

Create `src/minute-refresh.test.ts` with a controlled clock and timeout:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  millisecondsUntilNextMinute,
  startMinuteRefresh,
} from "./minute-refresh";

describe("minute refresh scheduler", () => {
  it("aligns to the next minute instead of drifting from startup", () => {
    expect(millisecondsUntilNextMinute(
      Date.parse("2026-07-27T14:37:42.250Z"),
    )).toBe(17_750);
    expect(millisecondsUntilNextMinute(
      Date.parse("2026-07-27T14:38:00.000Z"),
    )).toBe(60_000);
  });

  it("realigns each tick and cancels the pending timeout", () => {
    let now = Date.parse("2026-07-27T14:37:42.250Z");
    let callback: (() => void) | undefined;
    const setTimeoutImpl = vi.fn((next: () => void) => {
      callback = next;
      return 7;
    });
    const clearTimeoutImpl = vi.fn();
    const onMinute = vi.fn();
    const stop = startMinuteRefresh(onMinute, {
      now: () => now,
      setTimeoutImpl,
      clearTimeoutImpl,
    });

    expect(setTimeoutImpl).toHaveBeenLastCalledWith(
      expect.any(Function),
      17_750,
    );
    now = Date.parse("2026-07-27T14:38:00.125Z");
    callback?.();
    expect(onMinute).toHaveBeenCalledOnce();
    expect(setTimeoutImpl).toHaveBeenLastCalledWith(
      expect.any(Function),
      59_875,
    );

    stop();
    expect(clearTimeoutImpl).toHaveBeenCalledWith(7);
  });
});
```

- [x] **Step 2: Run the scheduler test and verify RED**

Run:

```bash
npx vitest run src/minute-refresh.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `minute-refresh.ts` does not exist.

- [x] **Step 3: Implement the drift-free scheduler**

Create `src/minute-refresh.ts`:

```ts
const MINUTE_MS = 60_000;

type SchedulerOptions = {
  readonly now?: () => number;
  readonly setTimeoutImpl?: typeof globalThis.setTimeout;
  readonly clearTimeoutImpl?: typeof globalThis.clearTimeout;
};

export function millisecondsUntilNextMinute(now: number): number {
  const remainder = ((now % MINUTE_MS) + MINUTE_MS) % MINUTE_MS;
  return remainder === 0 ? MINUTE_MS : MINUTE_MS - remainder;
}

export function startMinuteRefresh(
  onMinute: () => void,
  options: SchedulerOptions = {},
): () => void {
  const now = options.now ?? Date.now;
  const setTimeoutImpl = options.setTimeoutImpl ?? globalThis.setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? globalThis.clearTimeout;
  let stopped = false;
  let timer: ReturnType<typeof setTimeoutImpl> | undefined;

  const schedule = () => {
    timer = setTimeoutImpl(() => {
      if (stopped) return;
      onMinute();
      schedule();
    }, millisecondsUntilNextMinute(now()));
  };
  schedule();

  return () => {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) clearTimeoutImpl(timer);
  };
}
```

- [x] **Step 4: Write failing ID 3 transport assertions**

In `src/glasses.test.ts`:

```ts
expect(module.G2_RIGHT_TOP_TILES.map(({ id }) => id)).toEqual([3]);
```

Extend the refresh target test union with `"right-top"` and assert:

```ts
harness.request("right-top");
await vi.waitFor(() => expect(harness.imageIds).toHaveLength(5));
expect(harness.encodedTileIds.at(-1)).toEqual([3]);
```

In `src/App.test.tsx`, expose `onRefreshReady`, use fake timers or the pure
scheduler mock, cross one minute boundary, and assert:

```ts
expect(requestRefresh).toHaveBeenCalledWith("right-top");
```

Also assert unmount cancels the minute scheduler and no later refresh is
requested.

- [x] **Step 5: Run the focused transport/App tests and verify RED**

Run separately:

```bash
npx vitest run src/glasses.test.ts -t "right-top" \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/App.test.tsx -t "minute" \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the target and App timer are missing.

- [x] **Step 6: Implement the top-right target**

In `src/g2-canvas.ts` add:

```ts
export const G2_RIGHT_TOP_TILES = [G2_TILES[1]] as const;
```

Re-export it from `src/glasses.ts`. Extend:

```ts
export type FastCanvasRefreshTarget =
  | "left"
  | "right"
  | "right-top"
  | "all";
```

In `transmitFastCanvas()` add the mapping:

```ts
targetTiles: {
  all: G2_FAST_TILES,
  left: G2_LEFT_TILES,
  right: G2_RIGHT_TILES,
  "right-top": G2_RIGHT_TOP_TILES,
},
```

Keep the current coalescing rule. Deduplicate equal pending targets.
Promote differing targets to `all`.

- [x] **Step 7: Start and stop the minute trigger in App**

Import `startMinuteRefresh`. When `onRefreshReady` exposes the request
function, start exactly one scheduler:

```ts
requestLiveRefresh = request;
stopMinuteRefresh ??= startMinuteRefresh(
  () => requestLiveRefresh?.("right-top"),
);
```

Call `stopMinuteRefresh?.()` during React effect cleanup before transport
cleanup. Do not redraw in the timer. The existing
`beforeExternalRefresh: drawCurrentPage` callback redraws immediately before
encoding.

- [x] **Step 8: Run focused tests and commit**

Run separately:

```bash
npx vitest run src/minute-refresh.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/glasses.test.ts -t "right-top" \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/App.test.tsx -t "minute" \
  --no-file-parallelism --maxWorkers=1
```

Expected: every command exits 0.

Commit:

```bash
git add src/minute-refresh.ts src/minute-refresh.test.ts src/g2-canvas.ts \
  src/glasses.ts src/fast-canvas-transport.ts src/glasses.test.ts \
  src/App.tsx src/App.test.tsx
git commit -m "feat: refresh G2 clock on minute boundaries"
```

### Task 2: Refresh battery only on a real device-status change

**Files:**
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/glasses.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [x] **Step 1: Write failing device-status tests**

Build a bridge fixture with initial `DeviceInfo` serial `g2-one` and capture
the `onDeviceStatusChanged` callback. After the initial four-tile send, emit:

1. identical 82% charging state;
2. 81% for foreign serial `other`;
3. 81% for `g2-one`;
4. 81% charging for `g2-one`.

Assert `onBattery` receives only:

```ts
[
  { label: "G2", level: 82, charging: false },
  { label: "G2", level: 81, charging: false },
  { label: "G2", level: 81, charging: true },
]
```

Assert transport cleanup unsubscribes device status exactly once. In
`src/App.test.tsx`, invoke the captured `onBattery` after
`onRefreshReady` and assert:

```ts
expect(requestRefresh).toHaveBeenCalledWith("right-top");
```

Navigate to `news`. Emit another battery callback and assert no immediate refresh. Navigate back to `overview`. Assert that the renderer receives the newest battery.

- [x] **Step 2: Run the focused tests and verify RED**

Run separately:

```bash
npx vitest run src/glasses.test.ts -t "device status" \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/App.test.tsx -t "battery change" \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because fast transport does not subscribe to device status and
App only redraws the initial snapshot.

- [x] **Step 3: Normalize and deduplicate battery events**

Extend the internal transport bridge with optional:

```ts
getDeviceInfo?: () => Promise<DeviceInfo | null>;
onDeviceStatusChanged?: (
  listener: (status: DeviceStatus) => void,
) => () => void;
```

Keep the initial `DeviceInfo`, its serial, and the last normalized
`FastCanvasBattery`. After `transmitCanvas()` has completed startup, subscribe
to device status. Ignore a status whose serial differs. Normalize the matching
status using the initial model, compare `label`, `level`, and `charging`, and
call `options.onBattery` only for a changed value.

Make `transmitFastCanvas()` await the base cleanup and return one idempotent
cleanup that first unsubscribes device status, then disposes the base
transport. Missing device info or a missing event API remains a valid
`BATTERY --` path.

- [x] **Step 4: Make App battery refresh page-aware**

The initial callback still redraws before startup encoding. For later
deduplicated callbacks:

```ts
battery = nextBattery;
if (requestLiveRefresh && page === "overview") {
  requestLiveRefresh("right-top");
} else if (!requestLiveRefresh) {
  drawCurrentPage();
}
```

On a non-overview page retain state without transmitting. Normal page
navigation redraws the latest state.

- [x] **Step 5: Run focused tests and commit**

Run separately:

```bash
npx vitest run src/glasses.test.ts -t "device status" \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/App.test.tsx -t "battery change" \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: every command exits 0.

Commit:

```bash
git add src/fast-canvas-transport.ts src/glasses.test.ts \
  src/App.tsx src/App.test.tsx
git commit -m "feat: refresh changed G2 battery status"
```

### Task 3: Accept and persist meaningful continuous location fixes

**Files:**
- Modify: `src/location.ts`
- Modify: `src/location.test.ts`
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard.test.ts`
- Modify: `src/live-dashboard-map.test.ts`

- [x] **Step 1: Write failing location helper tests**

Add tests for:

```ts
expect(haversineMeters(point, point)).toBe(0);
expect(haversineMeters(
  { latitude: 37.5665, longitude: 126.978 },
  { latitude: 37.566635, longitude: 126.978 },
)).toBeGreaterThanOrEqual(15);
```

Test `normalizeLiveLocation()` rejects invalid coordinates, retains valid
accuracy/heading/speed, normalizes timestamps with the existing seven-day
rule, and returns a fresh `DataState<LocationValue>`. Test
`persistLiveLocation()` writes only `relic:location:v1`.

- [x] **Step 2: Write failing dashboard lifecycle tests**

Use a bridge that records and controls:

```ts
startAppLocationUpdates({
  accuracy: AppLocationAccuracy.Medium,
  intervalMs: 15_000,
  distanceFilter: 15,
});
onAppLocationChanged(listener);
stopAppLocationUpdates();
```

After startup, emit an invalid fix and a valid fix below 15 meters; assert no
new update and no location write. Emit a fix at least 15 meters away in the same map cell. Assert that the state and persisted cache change. Verify one `"left"` update and no new request to `/api/map`.

Dispose twice and assert the location subscription and SDK stop method are
each called once. Add a failed-start test proving a `false` or thrown
`startAppLocationUpdates()` leaves the one-shot location usable and does not
call stop.

- [x] **Step 3: Run location/dashboard tests and verify RED**

Run separately:

```bash
npx vitest run src/location.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/live-dashboard.test.ts src/live-dashboard-map.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because continuous location helpers and lifecycle are absent.

- [x] **Step 4: Extract reusable location normalization**

In `src/location.ts`, extend `LocationBridge` with optional continuous APIs.
Export:

```ts
export const LOCATION_UPDATE_INTERVAL_MS = 15_000;
export const LOCATION_UPDATE_DISTANCE_METERS = 15;

export function haversineMeters(
  left: Coordinate,
  right: Coordinate,
): number;

export function normalizeLiveLocation(
  location: AppLocation,
  now?: number,
): DataState<LocationValue> | undefined;

export function persistLiveLocation(
  bridge: LocationBridge,
  state: DataState<LocationValue>,
): Promise<boolean>;
```

Reuse these helpers inside `resolveInitialLocation()` so the initial and
streaming paths share coordinate, telemetry, timestamp, and cache behavior.

- [x] **Step 5: Add the continuous dashboard lifecycle**

After initial providers finish, call `startAppLocationUpdates()` with the exact
approved options. Subscribe only after a successful start. Queue location
callbacks so accepted fixes cannot race.

For each callback:

1. normalize the fix;
2. ignore it when disposed, invalid, or less than 15 meters from the last
   accepted coordinate;
3. replace `state.location`;
4. persist the latest fix without blocking the visible update;
5. emit `"left"`;
6. call `refreshMap()` only if `clientMapCell()` differs from the current
   map value cell.

Disposal immediately unsubscribes. If the SDK start completed successfully,
call `stopAppLocationUpdates()` exactly once. A late successful start after
disposal must stop itself without registering a live callback.

- [x] **Step 6: Run focused tests and commit**

Run separately:

```bash
npx vitest run src/location.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/live-dashboard.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/live-dashboard-map.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: every command exits 0.

Commit:

```bash
git add src/location.ts src/location.test.ts src/live-dashboard.ts \
  src/live-dashboard.test.ts src/live-dashboard-map.test.ts
git commit -m "feat: follow meaningful G2 location updates"
```

### Task 4: Use walking-sized OSM cells and retain prior geometry

**Files:**
- Modify: `src/map.ts`
- Modify: `src/map.test.ts`
- Modify: `server/map.js`
- Modify: `tests/map-api.test.mjs`
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard-map.test.ts`
- Modify: `src/live-dashboard.test.ts`
- Modify: `src/fast-map.test.ts`

- [x] **Step 1: Write failing cell and stale-fallback tests**

Define the new expected cell contract:

```ts
expect(clientMapCell({
  latitude: 37.5563,
  longitude: 126.922,
})).toBe("37.5552,126.9216");
expect(mapCell(37.5563, 126.922)).toBe("37.5552,126.9216");
```

Change the different-cell failure test to expect the prior valid map as
`stale`, and assert `onCached` receives it before the failed request. Add a dashboard test for an accepted fix in a new cell. Assert one new map request. If the request fails, `state.map.value` must retain the previous geometry with status `stale`.

- [x] **Step 2: Run client and server map tests and verify RED**

Run separately:

```bash
npx vitest run src/map.test.ts src/live-dashboard-map.test.ts \
  --no-file-parallelism --maxWorkers=1
node --test --test-concurrency=1 tests/map-api.test.mjs
```

Expected: FAIL on the old `0.005` cell and unavailable cross-cell fallback.

- [x] **Step 3: Implement the shared 0.0018-degree contract**

In both client and server:

```ts
const MAP_CELL_DEGREES = 0.0018;
const quantized = Math.floor(value / MAP_CELL_DEGREES)
  * MAP_CELL_DEGREES;
```

Format latitude and longitude with four decimal places. Advance the server
cache identity from `roads-labels-v2` to `roads-labels-v3`. Update normalized
map fixtures from:

```text
37.555,126.920
```

to:

```text
37.5552,126.9216
```

and use `clientMapCell()`/`mapCell()` in dynamic test responses where possible.

- [x] **Step 4: Preserve the last valid client map across cells**

In `resolveMap()`, distinguish:

```ts
const fallbackCache = cached && cached.fetchedAt <= now
  ? cached
  : undefined;
const usableCache = fallbackCache?.cell === cell
  ? fallbackCache
  : undefined;
```

When `fallbackCache` exists in a different cell, call `onCached` with it as
`stale` before requesting the new cell. On any request, validation, timeout,
or cell-mismatch failure, return that stale fallback instead of
`unavailable`.

In dashboard `refreshMap()`, also retain an already visible map as stale when
the provider has no usable cache. Never replace a visible map with an
unavailable state during movement.

- [x] **Step 5: Run focused map tests and commit**

Run separately:

```bash
npx vitest run src/map.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/live-dashboard-map.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-map.test.ts \
  --no-file-parallelism --maxWorkers=1
node --test --test-concurrency=1 tests/map-api.test.mjs
```

Expected: every command exits 0.

Commit:

```bash
git add src/map.ts src/map.test.ts server/map.js tests/map-api.test.mjs \
  src/live-dashboard.ts src/live-dashboard-map.test.ts \
  src/live-dashboard.test.ts src/fast-map.test.ts
git commit -m "feat: refresh OSM geometry at walking distance"
```

### Task 5: Prepare the serial G2 hardware checkpoint

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Create: `docs/hardware/2026-07-27-g2-live-refresh.md`
- Modify: `docs/superpowers/plans/2026-07-27-g2-live-refresh.md`

- [x] **Step 1: Write the failing QR identity assertion**

Change the expected URL to:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-refresh-017
```

- [x] **Step 2: Run the SDK test and verify RED**

Run:

```bash
npx vitest run src/sdk-version.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 1/2 fails because `package.json` still names
`map-labels-large-016`.

- [x] **Step 3: Update the QR script and verify GREEN**

Update `package.json`, then run:

```bash
npx vitest run src/sdk-version.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 2/2 pass.

- [x] **Step 4: Run the complete serial verification gate**

Run one command at a time:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 tests/map-api.test.mjs
node --test --test-concurrency=1 tests/news-api.test.mjs
git diff --check
```

Expected:

- every command exits 0;
- no test worker runs files in parallel;
- no whitespace errors remain.

- [x] **Step 5: Record automated evidence and commit**

Create `docs/hardware/2026-07-27-g2-live-refresh.md` with:

- exact tested commit and URL;
- source, typecheck, build, Sites, map API, and news API results;
- `PENDING` physical clock, battery, walking-map, bilateral, paging, and
  double-tap observations;
- no claims based only on automated transport tests.

Commit:

```bash
git add src/sdk-version.test.ts package.json \
  docs/hardware/2026-07-27-g2-live-refresh.md \
  docs/superpowers/plans/2026-07-27-g2-live-refresh.md
git commit -m "chore: prepare live G2 refresh checkpoint"
```

- [x] **Step 6: Restart the local server and open the QR**

Restart only the existing port 4176 Vite process, verify HTTP 200, then run:

```bash
npm run qr
```

Open:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-refresh-017
```

- [x] **Step 7: Record physical observations and push**

After the user reports the actual G2 result, replace `PENDING` with only those
observations. Commit the record. Rerun `git status --short`.
Push `feature/g2-fast-content`.

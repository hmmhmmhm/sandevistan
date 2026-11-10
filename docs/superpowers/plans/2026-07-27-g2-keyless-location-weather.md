# G2 Keyless Location and Weather Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a real or clearly labeled fallback location and current Open-Meteo weather without an API key. Preserve fast paging and serialized G2 image sends.

**Architecture:** Normalize provider data into a framework-independent `LiveDashboardState`; renderers consume snapshots and never fetch. A dashboard session resolves one SDK location and persists small JSON caches. The session refreshes weather independently. It requests left/right tile refreshes through the existing transport's coalescing queue.

**Tech Stack:** TypeScript, Even Hub SDK `0.0.11`, Open-Meteo Forecast API, Canvas 2D, Vitest

## As-run audit note

Tasks 1–5 were implemented in commits `51f6e59`, `53ee757`, `1021fed`,
`95a2201`, and `065ee6c`, with follow-up fixes and transport extraction through
tested commit `1da29615713c6e3f730ad0c61341d7dbe0e88435`.

The original Task 5 wording assumed that live OSM data and attribution would
arrive with location and weather. OSM belongs to the following dedicated plan
and was not present at this checkpoint. To avoid presenting the schematic as a
live map, the as-run HUD uses `LOC // LIVE · MAP DEMO`,
`LOC // LAST FIX · MAP DEMO`, or `LOC // DEMO · MAP DEMO`. The phone WebView
uses `Weather: Open-Meteo · Maps: Demo Schematic`. The original intention is recorded
here as a deviation rather than silently treating the OSM acceptance criteria
as complete.

---

### Task 1: Define live state and safe cache primitives

**Files:**
- Create: `src/live-state.ts`
- Create: `src/live-state.test.ts`
- Create: `src/live-cache.ts`
- Create: `src/live-cache.test.ts`

- [x] **Step 1: Write failing state and cache tests**

Assert these contracts:

```ts
expect(createInitialLiveDashboardState()).toEqual({
  location: {
    status: "loading",
    value: {
      coordinate: { latitude: 37.5563, longitude: 126.922 },
      source: "demo",
    },
  },
  weather: { status: "loading" },
  news: { status: "loading", value: [] },
  map: { status: "loading", value: { roads: [], attribution: "© OSM CONTRIBUTORS" } },
  route: { status: "disabled" },
});
```

For `readCache()`:

```ts
expect(await readCache(bridge, "weather", isWeatherCache)).toEqual(valid);
expect(await readCache(corruptBridge, "weather", isWeatherCache)).toBeUndefined();
expect(await writeCache(failingBridge, "weather", valid)).toBe(false);
expect(await clearCache(bridge, "weather")).toBe(true);
```

- [x] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/live-state.test.ts src/live-cache.test.ts
```

Expected: FAIL because the modules do not exist.

- [x] **Step 3: Add the normalized state model**

Define these exported types in `src/live-state.ts`:

```ts
export type DataStatus =
  | "loading"
  | "fresh"
  | "stale"
  | "unavailable"
  | "disabled";

export type Coordinate = {
  readonly latitude: number;
  readonly longitude: number;
};

export type DataState<T> = {
  readonly status: DataStatus;
  readonly value?: T;
  readonly fetchedAt?: number;
};

export type LocationValue = {
  readonly coordinate: Coordinate;
  readonly source: "live" | "cache" | "demo";
  readonly accuracy?: number;
  readonly heading?: number;
  readonly speed?: number;
};

export type WeatherValue = {
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly humidity: number;
  readonly windSpeed: number;
  readonly precipitationProbability: number;
  readonly weatherCode: number;
  readonly condition: string;
};

export type NewsItem = {
  readonly id: string;
  readonly title: string;
  readonly url?: string;
  readonly publishedAt?: number;
};

export type MapRoad = {
  readonly kind: "major" | "minor";
  readonly points: readonly Coordinate[];
};

export type MapValue = {
  readonly roads: readonly MapRoad[];
  readonly attribution: "© OSM CONTRIBUTORS";
  readonly cell?: string;
};

export type RouteManeuver = {
  readonly instruction: string;
  readonly distance: number;
  readonly wayPoints: readonly [number, number];
};

export type RouteValue = {
  readonly destinationName: string;
  readonly geometry: readonly Coordinate[];
  readonly maneuvers: readonly RouteManeuver[];
  readonly activeManeuverIndex: number;
  readonly remainingDistance: number;
  readonly profile: "foot-walking" | "cycling-regular" | "driving-car";
};

export type LiveDashboardState = {
  readonly location: DataState<LocationValue>;
  readonly weather: DataState<WeatherValue>;
  readonly news: DataState<readonly NewsItem[]>;
  readonly map: DataState<MapValue>;
  readonly route: DataState<RouteValue>;
};
```

Export:

```ts
export const DEMO_COORDINATE = {
  latitude: 37.5563,
  longitude: 126.922,
} as const;

export function createInitialLiveDashboardState(): LiveDashboardState {
  return {
    location: {
      status: "loading",
      value: { coordinate: DEMO_COORDINATE, source: "demo" },
    },
    weather: { status: "loading" },
    news: { status: "loading", value: [] },
    map: {
      status: "loading",
      value: { roads: [], attribution: "© OSM CONTRIBUTORS" },
    },
    route: { status: "disabled" },
  };
}
```

- [x] **Step 4: Add cache isolation**

In `src/live-cache.ts`, export:

```ts
export type EvenStorage = {
  getLocalStorage(key: string): Promise<string>;
  setLocalStorage(key: string, value: string): Promise<boolean>;
};

export async function readCache<T>(
  storage: EvenStorage,
  key: string,
  validate: (value: unknown) => value is T,
): Promise<T | undefined> {
  try {
    const raw = await storage.getLocalStorage(`relic:${key}:v1`);
    if (!raw) return undefined;
    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function writeCache<T>(
  storage: EvenStorage,
  key: string,
  value: T,
): Promise<boolean> {
  try {
    return await storage.setLocalStorage(
      `relic:${key}:v1`,
      JSON.stringify(value),
    );
  } catch {
    return false;
  }
}

export async function clearCache(
  storage: EvenStorage,
  key: string,
): Promise<boolean> {
  try {
    return await storage.setLocalStorage(`relic:${key}:v1`, "");
  } catch {
    return false;
  }
}
```

- [x] **Step 5: Verify and commit**

```bash
npx vitest run src/live-state.test.ts src/live-cache.test.ts
git add src/live-state.ts src/live-state.test.ts src/live-cache.ts src/live-cache.test.ts
git commit -m "feat: add live dashboard state and cache"
```

Expected: focused tests pass.

### Task 2: Resolve SDK location with cache and demo fallback

**Files:**
- Create: `src/location.ts`
- Create: `src/location.test.ts`

- [x] **Step 1: Write the fallback-order tests**

Use a fake bridge and assert:

```ts
expect((await resolveInitialLocation(liveBridge, 2000)).value.source).toBe("live");
expect((await resolveInitialLocation(nullBridgeWithCache, 2000)).value.source)
  .toBe("cache");
expect((await resolveInitialLocation(failingBridge, 2000)).value).toEqual({
  coordinate: DEMO_COORDINATE,
  source: "demo",
});
```

Also reject latitude outside `[-90, 90]`, longitude outside `[-180, 180]`,
non-finite values, and cache timestamps older than seven days.

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run src/location.test.ts
```

Expected: FAIL because `location.ts` does not exist.

- [x] **Step 3: Implement one-shot location**

Define:

```ts
export type LocationBridge = EvenStorage & {
  getAppLocation(options?: AppLocationOptions): Promise<AppLocation | null>;
};

export type LocationCache = {
  readonly value: LocationValue;
  readonly fetchedAt: number;
};

export async function resolveInitialLocation(
  bridge: LocationBridge,
  now?: number,
): Promise<DataState<LocationValue>>;
```

Call:

```ts
await bridge.getAppLocation({
  accuracy: AppLocationAccuracy.Medium,
  timeoutMs: 5000,
});
```

Normalize valid results into:

```ts
{
  status: "fresh",
  value: {
    coordinate: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    source: "live",
    accuracy: location.accuracy,
    heading: location.heading,
    speed: location.speed,
  },
  fetchedAt: location.timestamp ?? now,
}
```

Write successful fixes to `relic:location:v1`. On null/error, read the cache;
if valid and no older than seven days return it with source `cache` and status
`stale`. Otherwise return the demo coordinate with status `unavailable`.

- [x] **Step 4: Verify and commit**

```bash
npx vitest run src/location.test.ts src/live-cache.test.ts
git add src/location.ts src/location.test.ts
git commit -m "feat: resolve keyless Even Hub location"
```

### Task 3: Fetch and normalize Open-Meteo weather

**Files:**
- Create: `src/weather.ts`
- Create: `src/weather.test.ts`

- [x] **Step 1: Write weather URL, parsing, and stale-cache tests**

Assert that the URL contains:

```text
https://api.open-meteo.com/v1/forecast
current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m
hourly=precipitation_probability
forecast_days=1
timezone=auto
```

Parse this fixture:

```ts
const fixture = {
  current: {
    time: "2026-07-27T14:15",
    temperature_2m: 29.4,
    apparent_temperature: 31.1,
    relative_humidity_2m: 67,
    weather_code: 1,
    wind_speed_10m: 8.2,
  },
  hourly: {
    time: ["2026-07-27T14:00", "2026-07-27T15:00"],
    precipitation_probability: [10, 20],
  },
};
```

Expected condition is `mostly clear` and precipitation probability is `20`.
Also assert a failed refresh returns the prior cache as `stale`, while no cache
returns `unavailable`.

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run src/weather.test.ts
```

- [x] **Step 3: Implement the provider**

Export:

```ts
export const WEATHER_MAX_AGE_MS = 15 * 60 * 1000;

export function weatherCodeLabel(code: number): string;
export function buildWeatherUrl(coordinate: Coordinate): URL;
export function parseWeatherResponse(input: unknown): WeatherValue;
export async function resolveWeather(
  storage: EvenStorage,
  coordinate: Coordinate,
  fetchImpl?: typeof fetch,
  now?: number,
  onCached?: (cached: DataState<WeatherValue>) => void,
): Promise<DataState<WeatherValue>>;
```

Use short Korean WMO labels:

```ts
if (code === 0) return "Sunny";
if (code <= 2) return "Partly sunny";
if (code === 3) return "cloudy";
if (code <= 48) return "fog";
if (code <= 57) return "drizzle";
if (code <= 67) return "Rain";
if (code <= 77) return "eye";
if (code <= 82) return "shower";
if (code <= 86) return "Snow Showers";
if (code <= 99) return "Thunderstorm";
return "unknown";
```

Reject malformed or non-finite fields. If a cache exists, call `onCached` before
starting a network request. The HUD can then display the cached data immediately.
If the cache is younger than 15 minutes, return it without a request.
Otherwise, fetch with an `AbortController` eight-second timeout. Persist successful results.
On error, retain the stale cache. Never throw to the dashboard session.

- [x] **Step 4: Verify and commit**

```bash
npx vitest run src/weather.test.ts src/location.test.ts
git add src/weather.ts src/weather.test.ts
git commit -m "feat: add keyless Open-Meteo weather"
```

### Task 4: Add a coalescing live-image refresh path

**Files:**
- Modify: `src/glasses.ts`
- Modify: `src/glasses.test.ts`

- [x] **Step 1: Write failing refresh serialization tests**

Add a test that captures the callback exposed by `onRefreshReady`, then requests
`left` and `right` before the queued operation begins:

```ts
requestRefresh!("left");
requestRefresh!("right");

await vi.waitFor(() => expect(encodedTileIds).toHaveLength(2));
expect(encodedTileIds).toEqual([
  [3, 5, 2, 4],
  [3, 5, 2, 4],
]);
expect(maximumConcurrentImageSends).toBe(1);
```

Add a hidden-state assertion:

```ts
emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
await hideFinished;
requestRefresh!("right");
expect(encodedTileIds).not.toContainEqual([3, 5]);
emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
await restoreFinished;
expect(encodedTileIds.at(-1)).toEqual([3, 5, 2, 4]);
```

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run src/glasses.test.ts -t "live refresh"
```

- [x] **Step 3: Extend the fast transport contract**

Export:

```ts
export const G2_LEFT_TILES = [G2_TILES[0], G2_TILES[2]] as const;
export type FastCanvasRefreshTarget = "left" | "right" | "all";
export type FastCanvasRefreshRequest = (
  target: FastCanvasRefreshTarget,
) => void;
```

Extend `FastCanvasOptions` with:

```ts
readonly beforeExternalRefresh?: () => void | Promise<void>;
readonly onRefreshReady?: (request: FastCanvasRefreshRequest) => void;
```

Inside the same `operationQueue` used by scroll and hide/restore:

- merge `left + right` into `all`;
- keep one pending external refresh operation;
- call `beforeExternalRefresh` immediately before encoding;
- map `left` to IDs `2/4`, `right` to `3/5`, and `all` to `3/5/2/4`;
- skip sends while hidden;
- release the scheduled flag in `finally`, even after `SENDFAILED`;
- if a new target arrived during the send, schedule one newest-state follow-up.

Do not create another promise queue or call `updateImageRawData` outside
`refreshImages()`.

Keep user-forward page order `1→2→3→4`; full-frame tile order does not require
SDK event-direction inversion.

- [x] **Step 4: Verify the transport contract**

```bash
npx vitest run src/glasses.test.ts
```

Expected: all existing startup, scroll, display-toggle, retry, and new live
refresh tests pass.

- [x] **Step 5: Commit**

```bash
git add src/glasses.ts src/glasses.test.ts
git commit -m "feat: queue live fast Canvas refreshes"
```

### Task 5: Integrate live location and weather into the fast HUD

**Files:**
- Create: `src/live-dashboard.ts`
- Create: `src/live-dashboard.test.ts`
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-canvas-hud.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `app.json`

- [x] **Step 1: Write failing dashboard and rendering tests**

The session test must observe:

```ts
expect(updates.map(({ target }) => target)).toEqual(["left", "right"]);
expect(updates[0].state.location.value?.source).toBe("live");
expect(updates[1].state.weather.value?.temperature).toBe(29.4);
```

The renderer test must assert:

```ts
expect(hud.values).toEqual(expect.arrayContaining([
  "LOC // LIVE · MAP DEMO",
  "29°C Mostly sunny",
  “Feeling 31° Humidity 67%”,
  “Precipitation 20%, wind 8km/h”,
]));
```

For unavailable weather:

```ts
expect(hud.values).toContain("WEATHER --");
```

The App test must assert the fast-route WebView credits contain:

```ts
expect(screen.getByText(
  "Weather: Open-Meteo · Maps: Demo Schematic",
)).toBeTruthy();
```

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run src/live-dashboard.test.ts src/fast-canvas-hud.test.ts src/App.test.tsx
```

- [x] **Step 3: Implement the dashboard session**

Export:

```ts
export type LiveDashboardUpdate = {
  readonly state: LiveDashboardState;
  readonly target: "left" | "right" | "all";
};

export function createLiveDashboardSession(options: {
  bridge: LocationBridge;
  onUpdate(update: LiveDashboardUpdate): void;
  fetchImpl?: typeof fetch;
  now?: () => number;
  documentTarget?: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
}): {
  start(): Promise<void>;
  getState(): LiveDashboardState;
  dispose(): void;
};
```

`start()` resolves location, emits `left`, then resolves weather with:

```ts
const weather = await resolveWeather(
  bridge,
  coordinate,
  fetchImpl,
  now(),
  (cached) => patch({ weather: cached }, "right"),
);
patch({ weather }, "right");
```

Register `visibilitychange`; when the document becomes visible, refresh weather
only if its cache is older than 15 minutes. `dispose()` removes the listener
and prevents late async results from emitting.

- [x] **Step 4: Render normalized values**

Change the fourth `drawFastCanvasHud()` argument to:

```ts
export type FastCanvasHudData = {
  readonly battery?: FastCanvasBattery;
  readonly live: LiveDashboardState;
};
```

Keep a default snapshot so tests and the WebView preview render safely. In the
as-run pre-OSM build, replace the fixed map header with
`LOC // LIVE · MAP DEMO`, `LOC // LAST FIX · MAP DEMO`, or
`LOC // DEMO · MAP DEMO`. Replace both fixed weather strings with live values;
round displayed numbers. Keep all coordinates, frame geometry, page order,
font sizes, and palette unchanged.

- [x] **Step 5: Wire the session after the initial G2 send**

In the fast route:

1. wait for the existing initial four-tile transmission;
2. capture `onRefreshReady`;
3. obtain the SDK bridge with `waitForEvenAppBridge()`;
4. start one dashboard session;
5. on update, assign the newest live state and request its target;
6. pass `drawCurrentPage` as both `beforeExternalRefresh` and `beforeRestore`;
7. dispose the dashboard session and transport listener in the effect cleanup.

Do not start the session on legacy routes.

Below the fast-route preview note, render a phone-only credit:

```text
Weather: Open-Meteo · Maps: Demo Schematic
```

Do not transmit this credit to the G2 Canvas. OSM attribution is deferred until
the OSM map phase actually supplies OSM-derived geometry.

- [x] **Step 6: Declare only the required permissions**

Set `app.json` permissions to:

```json
[
  {
    "name": "location",
    "desc": "Display maps and weather based on your current location."
  },
  {
    "name": "network",
    "desc": "Load current weather and RELIC live data.",
    "whitelist": ["https://api.open-meteo.com"]
  }
]
```

- [x] **Step 7: Verify and commit**

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
git add app.json src/App.tsx src/App.test.tsx src/fast-canvas-hud.ts \
  src/fast-canvas-hud.test.ts src/live-dashboard.ts src/live-dashboard.test.ts
git commit -m "feat: show keyless location and weather"
```

Expected: all commands exit `0`.

### Task 6: Physical keyless location/weather checkpoint

**Files:**
- Create: `docs/hardware/2026-07-27-keyless-location-weather.md`

- [x] **Step 1: Open the Tailscale build**

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-weather-012
```

- [x] **Step 2: Verify on the G2**

Confirm:

- initial HUD appears before any five-second location timeout;
- header remains truthfully `LOC // LIVE · MAP DEMO`,
  `LOC // LAST FIX · MAP DEMO`, or `LOC // DEMO · MAP DEMO`;
- weather values replace the sample without a key;
- scroll remains immediate;
- bilateral output and visible double-tap hide/restore continue to work.

The user confirmed these visible checks as a whole. The exact location label and
weather values were not transcribed.

The following internal transport conditions passed automated tests but were not
separately instrumented on the physical G2 during this checkpoint:

- a weather-only refresh sends right IDs `3/5`;
- hidden refreshes do not transmit;
- restore uses the newest complete frame after a hidden-state update.

- [x] **Step 3: Record and commit the result**

Document the exact observed source label, weather values, and transfer behavior
when they are transcribed. Otherwise explicitly record which details were not
transcribed, without inferring them, then:

```bash
git add docs/hardware/2026-07-27-keyless-location-weather.md
git commit -m "docs: verify keyless location and weather on G2"
```

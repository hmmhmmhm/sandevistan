# G2 Keyless OSM Map Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the schematic road grid with bounded OpenStreetMap road geometry rendered by Sandevistan’s own Canvas code, without a map API key or WebView screenshot.

**Architecture:** The existing same-origin API router submits one fixed-radius Overpass query for a rounded location cell and returns compact normalized lines. The client caches geometry for 24 hours. It projects the geometry into the fixed left `288 x 288` region. It requests only tile IDs `2/4`.

**Tech Stack:** OpenStreetMap data, Overpass API, Sites Worker, TypeScript, Canvas 2D, Node test runner, Vitest

---

### Task 1: Add a bounded Overpass road endpoint

**Files:**
- Create: `server/map.js`
- Create: `tests/map-api.test.mjs`
- Modify: `server/api-router.js`
- Modify: `scripts/prepare-sites-build.mjs`
- Modify: `tests/sites-worker.test.mjs`

- [x] **Step 1: Write request validation and normalization tests**

Assert:

```js
GET /api/map?lat=37.5563&lng=126.922 -> 200 normalized JSON
GET /api/map?lat=91&lng=126.922      -> 400 INVALID_COORDINATE
GET /api/map?lat=x&lng=126.922       -> 400 INVALID_COORDINATE
POST /api/map                         -> 404 API_NOT_FOUND
```

Given:

```js
{
  elements: [
    {
      type: "way",
      tags: { highway: "primary" },
      geometry: [
        { lat: 37.55, lon: 126.91 },
        { lat: 37.56, lon: 126.92 },
      ],
    },
    {
      type: "way",
      tags: { highway: "residential" },
      geometry: [
        { lat: 37.56, lon: 126.92 },
        { lat: 37.57, lon: 126.93 },
      ],
    },
  ],
}
```

expect:

```js
{
  cell: "37.555,126.920",
  attribution: "© OSM CONTRIBUTORS",
  roads: [
    {
      kind: "major",
      points: [[37.55, 126.91], [37.56, 126.92]],
    },
    {
      kind: "minor",
      points: [[37.56, 126.92], [37.57, 126.93]],
    },
  ],
}
```

Also assert the query has `around:650`, selects only `way["highway"]`, and
ends with `out geom;`.

- [x] **Step 2: Run and verify RED**

```bash
node --test tests/map-api.test.mjs
```

- [x] **Step 3: Implement coordinate and cell helpers**

Export from `server/map.js`:

```js
export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const MAP_RADIUS_METERS = 650;

export function mapCell(latitude, longitude) {
  const lat = Math.floor(latitude / 0.005) * 0.005;
  const lng = Math.floor(longitude / 0.005) * 0.005;
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function buildOverpassQuery(latitude, longitude) {
  return `[out:json][timeout:8];way["highway"](around:${MAP_RADIUS_METERS},${latitude},${longitude});out geom;`;
}
```

Reject non-finite or out-of-range coordinates before generating a query.

- [x] **Step 4: Implement compact road normalization**

Classify these OSM highway tags as `major`:

```js
new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
])
```

Treat other valid highway ways as `minor`. Drop elements without at least two
finite geometry points. Cap the result at 180 ways and 4,000 total points;
prefer major ways before truncating.

- [x] **Step 5: Fetch with limits and cache by cell**

Export:

```js
export async function handleMapRequest(
  request,
  env,
  {
    fetchImpl = fetch,
    cache = globalThis.caches?.default,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
)
```

Import `jsonResponse`, `readLimitedBytes`, and `createTimeout` from
`./http.js`. Do not import from `api-router.js`, which imports this handler.

Send the query as:

```js
{
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent": "RELIC-G2-Personal-Prototype/0.1",
  },
  body: new URLSearchParams({ data: query }),
  redirect: "error",
}
```

Use an eight-second timeout and a one-megabyte response limit. Cache the
normalized response under an internal GET key containing only the rounded cell
for 24 hours. Return:

```text
cache-control: public, max-age=3600, s-maxage=86400
```

Use stable errors:

```text
INVALID_COORDINATE 400
MAP_TIMEOUT 504
MAP_TOO_LARGE 502
MAP_UPSTREAM_ERROR 502
```

- [x] **Step 6: Route, package, verify, and commit**

Add this branch before the router’s fallback:

```js
if (url.pathname === "/api/map" && request.method === "GET") {
  return handleMapRequest(request, env, dependencies);
}
```

Copy `server/map.js` into `dist/server/` and require it in the packaging test.
Then:

```bash
node --test tests/map-api.test.mjs tests/news-api.test.mjs \
  tests/api-router.test.mjs tests/sites-worker.test.mjs
git add server/map.js server/api-router.js scripts/prepare-sites-build.mjs \
  tests/map-api.test.mjs tests/sites-worker.test.mjs
git commit -m "feat: proxy bounded OSM road geometry"
```

### Task 2: Cache and project OSM roads on the client

**Files:**
- Create: `src/map.ts`
- Create: `src/map.test.ts`
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard.test.ts`

- [x] **Step 1: Write parsing, projection, and cache-cell tests**

Assert:

```ts
expect(parseMapResponse(response).roads[0]).toEqual({
  kind: "major",
  points: [
    { latitude: 37.55, longitude: 126.91 },
    { latitude: 37.56, longitude: 126.92 },
  ],
});
```

For a 650-meter view centered at the live coordinate:

```ts
expect(projectCoordinate(center, center, 650)).toEqual({ x: 144, y: 144 });
expect(projectCoordinate(north, center, 650).y).toBeLessThan(144);
expect(projectCoordinate(east, center, 650).x).toBeGreaterThan(144);
```

Assert two coordinates in the same `0.005` cell cause one request and crossing
the cell boundary causes a second request. Assert a failed refresh keeps the
last map as `stale`.

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run src/map.test.ts src/live-dashboard.test.ts
```

- [x] **Step 3: Implement client map helpers**

Export:

```ts
export const MAP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const MAP_RADIUS_METERS = 650;

export function clientMapCell(coordinate: Coordinate): string;
export function parseMapResponse(input: unknown): MapValue;
export function projectCoordinate(
  point: Coordinate,
  center: Coordinate,
  radiusMeters?: number,
): { readonly x: number; readonly y: number };
export async function resolveMap(
  storage: EvenStorage,
  coordinate: Coordinate,
  fetchImpl?: typeof fetch,
  now?: number,
  onCached?: (cached: DataState<MapValue>) => void,
): Promise<DataState<MapValue>>;
```

Use a local tangent-plane projection:

```ts
const metersPerDegreeLat = 111_320;
const metersPerDegreeLng =
  111_320 * Math.cos(center.latitude * Math.PI / 180);
const east = (point.longitude - center.longitude) * metersPerDegreeLng;
const north = (point.latitude - center.latitude) * metersPerDegreeLat;
const scale = 112 / radiusMeters;
return {
  x: 144 + east * scale,
  y: 144 - north * scale,
};
```

Clamp rendered points to the map viewport, not the stored geometry. Fetch:

```text
/api/map?lat=<latitude>&lng=<longitude>
```

only when the location cell differs from the valid cached map cell.
Call `onCached` before refreshing a stale matching cell so the last map is
visible while Overpass responds.

- [x] **Step 4: Integrate map resolution**

After initial location resolves, start weather and map independently:

```ts
void resolveMap(
  storage,
  coordinate,
  fetchImpl,
  now(),
  (cached) => patch({ map: cached }, "left"),
).then((map) => {
  patch({ map }, "left");
});
```

Map failure must not alter location or weather. Late results after `dispose()`
must not emit.

- [x] **Step 5: Verify and commit**

```bash
npx vitest run src/map.test.ts src/live-dashboard.test.ts
git add src/map.ts src/map.test.ts src/live-dashboard.ts src/live-dashboard.test.ts
git commit -m "feat: cache and project OSM roads"
```

### Task 3: Draw the live tactical map in the fixed left panel

**Files:**
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-canvas-hud.test.ts`

- [x] **Step 1: Write Canvas layer tests**

Assert:

- minor road strokes use `#808080` width `1`;
- major road strokes use `#d0d0d0` width `2`;
- active route, when present, is painted after every base road;
- position arrow is painted after the route;
- all projected road points remain inside `x=18..270`, `y=34..244`;
- `© OSM CONTRIBUTORS` is always present;
- left snapshots remain identical across the four pages for one state.

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run src/fast-canvas-hud.test.ts
```

- [x] **Step 3: Replace the schematic grid**

Change `drawStaticMap()` to accept:

```ts
function drawLiveMap(
  context: CanvasRenderingContext2D,
  location: DataState<LocationValue>,
  map: DataState<MapValue>,
  route: DataState<RouteValue>,
)
```

Draw in this order:

1. unchanged corner frame and source label;
2. normalized minor roads;
3. normalized major roads;
4. active route geometry, if any;
5. current-position arrow rotated by finite heading, otherwise north;
6. black lower strip, source/status, and attribution.

Do not draw OSM street labels. If map data are unavailable, draw the existing
schematic roads and label them `SCHEMATIC`. Do not show them as live.

- [x] **Step 4: Full verification and commit**

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
git add src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts
git commit -m "feat: render live OSM tactical map"
```

### Task 4: Physical OSM checkpoint

**Files:**
- Create: `docs/hardware/2026-07-27-keyless-osm-map.md`

- [x] **Step 1: Open**

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-map-014
```

- [x] **Step 2: Verify**

Confirm that nearby roads are recognizable and the position arrow and attribution are readable. Verify that map refresh sends only IDs `2/4`. Within one cache cell, verify that no map request occurs. Confirm unchanged right-page scroll speed.

- [x] **Step 3: Record and commit**

```bash
git add docs/hardware/2026-07-27-keyless-osm-map.md
git commit -m "docs: verify keyless OSM map on G2"
```

# G2 Optional ORS Routing Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add destination search and turn-by-turn route guidance through OpenRouteService only when `ORS_API_KEY` exists, with a clean routing-disabled state otherwise.

**Architecture:** The client never contacts ORS or sees its key. Same-origin server endpoints expose status, normalized geocoding, and normalized directions. A navigation session starts continuous Even SDK location only for an active route and feeds throttled map/right-panel refreshes into the shared G2 queue.

**Tech Stack:** OpenRouteService APIs, Sites Worker secrets, Even Hub SDK `0.0.11`, React, TypeScript, Canvas 2D, Node test runner, Vitest

## Implementation checkpoint

Tasks 1 through 4 were implemented on `feature/g2-ors-routing` in:

- `d0dcef6aeb7132685ce6824a8b219a4ae6319d2d`: secret-gated server API;
- `003d318f800d5223dbfa7a32a20cd32c3a47989b`: phone controls,
  route lifecycle, progress tracking, rerouting, and G2 rendering.
- `3ad0435cd137c544a2989a5588aa102af90ea9d5`: serialized route-cache
  persistence and explicit-end race regression coverage.
- `d36c464a5a1baad2fe86188de86b9dccecd6437e`: block routing from the
  labelled demo coordinate and retain combined route refreshes in fullscreen.

The implementation intentionally retains the later hardware-approved general
location stream. Normal map mode uses `15 s / 15 m`; active navigation switches
the same serialized stream to `2 s / 5 m` and returns to normal settings when
navigation ends. This supersedes the older statement below that continuous
location is entirely off while routing is idle.

Automated verification is complete in both routing configurations:

- no key: keyless location, weather, RSS, and OSM remain independent while
  route status is disabled;
- fake server-only key: search, route normalization, client lifecycle,
  progress, reroute cooldown, late-response suppression, and secret isolation
  are covered;
- full serial suite: `26` files and `266` tests;
- typecheck, production build, Sites packaging, and all server API tests pass.

Task 5 remains a physical hardware gate. The no-key and real-key observations
must be recorded without ever recording the key.

---

### Task 1: Add secret-gated ORS server endpoints

**Files:**
- Create: `server/route.js`
- Create: `tests/route-api.test.mjs`
- Modify: `server/api-router.js`
- Modify: `scripts/prepare-sites-build.mjs`
- Modify: `tests/sites-worker.test.mjs`

- [ ] **Step 1: Write the key-missing tests**

Without `env.ORS_API_KEY`, assert:

```js
GET /api/routing-status -> 200 { enabled: false }
GET /api/geocode?q=Seoul Station -> 503 ROUTING_DISABLED
POST /api/route          -> 503 ROUTING_DISABLED
```

After each response:

```js
assert.doesNotMatch(await response.clone().text(), /fake-ors-secret/);
```

- [ ] **Step 2: Write validation and enabled-path tests**

With `env.ORS_API_KEY = "fake-ors-secret"`, assert:

```text
q shorter than 2 or longer than 80 -> 400 INVALID_QUERY
unsupported profile               -> 400 INVALID_PROFILE
out-of-range coordinate            -> 400 INVALID_COORDINATE
malformed JSON                     -> 400 INVALID_JSON
```

Allow only:

```js
new Set(["foot-walking", "cycling-regular", "driving-car"])
```

Assert the upstream route request uses:

```js
{
  method: "POST",
  headers: {
    authorization: "fake-ors-secret",
    "content-type": "application/json",
    accept: "application/geo+json",
  },
  body: JSON.stringify({
    coordinates: [[126.922, 37.5563], [126.9707, 37.5547]],
    instructions: true,
    language: "ko",
  }),
}
```

Assert the secret never occurs in the returned normalized JSON.

- [ ] **Step 3: Run and verify RED**

```bash
node --test tests/route-api.test.mjs
```

- [ ] **Step 4: Implement routing status and geocoding**

Export:

```js
export function routingStatus(env) {
  return { enabled: typeof env.ORS_API_KEY === "string" && env.ORS_API_KEY.length > 0 };
}

export async function handleRoutingStatus(_request, env) {
  return jsonResponse(routingStatus(env), {
    headers: { "cache-control": "no-store" },
  });
}

export async function handleGeocodeRequest(request, env, dependencies = {});
export async function handleRouteRequest(request, env, dependencies = {});
```

Import `jsonResponse`, `readLimitedBytes`, and `createTimeout` from
`./http.js`. Do not import from `api-router.js`, which imports these handlers.

Geocode through:

```text
https://api.openrouteservice.org/geocode/search
```

with upstream query parameters:

```text
api_key=<server secret>
text=<validated query>
boundary.country=KR
size=5
```

Return only:

```js
{
  results: [
    {
      id: String(feature.properties.id ?? feature.properties.gid),
      name: String(feature.properties.name),
      label: String(feature.properties.label),
      coordinate: {
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      },
    },
  ],
}
```

Drop malformed features and cap at five.

Geocoding uses the same eight-second timeout, redirect rejection, and
one-megabyte response limit as the other server providers. Do not include the
upstream URL, query string, or secret in an error response.

- [ ] **Step 5: Implement normalized directions**

Call:

```text
https://api.openrouteservice.org/v2/directions/<profile>/geojson
```

Use an eight-second timeout, `redirect: "error"`, and a two-megabyte response
limit. Normalize only the first feature:

```js
{
  geometry: feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  distance: feature.properties.summary.distance,
  duration: feature.properties.summary.duration,
  maneuvers: feature.properties.segments[0].steps.map((step) => ({
    instruction: step.instruction,
    distance: step.distance,
    wayPoints: step.way_points,
  })),
}
```

Reject an empty/malformed route as `ROUTE_UPSTREAM_ERROR`. Stable errors:

```text
ROUTING_DISABLED 503
INVALID_QUERY 400
INVALID_JSON 400
INVALID_PROFILE 400
INVALID_COORDINATE 400
ROUTE_TIMEOUT 504
ROUTE_TOO_LARGE 502
ROUTE_UPSTREAM_ERROR 502
GEOCODE_UPSTREAM_ERROR 502
```

- [ ] **Step 6: Route and package the endpoints**

Add:

```js
if (url.pathname === "/api/routing-status" && request.method === "GET") {
  return handleRoutingStatus(request, env);
}
if (url.pathname === "/api/geocode" && request.method === "GET") {
  return handleGeocodeRequest(request, env, dependencies);
}
if (url.pathname === "/api/route" && request.method === "POST") {
  return handleRouteRequest(request, env, dependencies);
}
```

Copy `server/route.js` into `dist/server/` and require it in the packaging test.

- [ ] **Step 7: Verify secret isolation and commit**

```bash
node --test tests/route-api.test.mjs tests/map-api.test.mjs \
  tests/news-api.test.mjs tests/api-router.test.mjs tests/sites-worker.test.mjs
git grep -n "ORS_API_KEY" -- src app.json package.json
```

Expected: tests pass and `git grep` exits `1` with no client matches.

```bash
git add server/route.js server/api-router.js scripts/prepare-sites-build.mjs \
  tests/route-api.test.mjs tests/sites-worker.test.mjs
git commit -m "feat: add optional server-side ORS routing"
```

### Task 2: Add client routing APIs and phone destination controls

**Files:**
- Create: `src/routing.ts`
- Create: `src/routing.test.ts`
- Create: `src/RouteControls.tsx`
- Create: `src/RouteControls.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write API normalization tests**

Assert:

```ts
expect(await getRoutingStatus(fetchDisabled)).toEqual({ enabled: false });
expect(await searchDestinations("Seoul Station", fetchEnabled)).toHaveLength(5);
expect(await requestRoute({
  start,
  destination,
  profile: "foot-walking",
}, fetchEnabled)).toMatchObject({
  destinationName: "Seoul Station",
  activeManeuverIndex: 0,
  profile: "foot-walking",
});
```

Assert `ROUTING_DISABLED` becomes a typed disabled result rather than an
uncaught exception.

- [ ] **Step 2: Write destination-control tests**

On a disabled status:

```ts
expect(screen.getByText("Directions available after connecting ORS key")).toBeTruthy();
expect(screen.queryByRole("textbox")).toBeNull();
```

On enabled status:

```ts
fireEvent.change(screen.getByRole("textbox"), { target: { value: "Seoul Station" } });
fireEvent.submit(screen.getByRole("form"));
await screen.findByRole("button", { name: /Seoul Station/ });
```

Selecting a result must call `onStart(destination, "foot-walking")`; an active
route must expose an `End route finding` button.

- [ ] **Step 3: Run and verify RED**

```bash
npx vitest run src/routing.test.ts src/RouteControls.test.tsx src/App.test.tsx
```

- [ ] **Step 4: Implement the client API**

Export:

```ts
export type RoutingStatus = { readonly enabled: boolean };
export type Destination = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly coordinate: Coordinate;
};
export type RouteProfile =
  | "foot-walking"
  | "cycling-regular"
  | "driving-car";

export async function getRoutingStatus(fetchImpl?: typeof fetch): Promise<RoutingStatus>;
export async function searchDestinations(
  query: string,
  fetchImpl?: typeof fetch,
): Promise<readonly Destination[]>;
export async function requestRoute(
  request: {
    readonly start: Coordinate;
    readonly destination: Destination;
    readonly profile: RouteProfile;
  },
  fetchImpl?: typeof fetch,
): Promise<RouteValue>;
```

All calls are same-origin. Set a client eight-second timeout. Parse and validate
every response. Never accept raw ORS structures in the renderer.

- [ ] **Step 5: Implement phone-only controls**

Render `RouteControls` below the existing HUD preview only on
`/hud-canvas-fast`. It must:

- show no text input when status is disabled;
- require at least two trimmed characters;
- debounce is unnecessary because search occurs only on submit;
- show at most five result buttons;
- expose walking/cycling/driving selection;
- disable controls while searching or starting;
- display a concise error and preserve the prior HUD on failure;
- show one end-navigation button when active.

Use the existing green/black WebView palette. Do not add native G2 text
containers or change Canvas geometry.

On fast-route startup, call `getRoutingStatus()` once and pass the result to
both `RouteControls` and the live dashboard. A failed status request is treated
as disabled; it must not affect location, weather, news, or map startup.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run src/routing.test.ts src/RouteControls.test.tsx src/App.test.tsx
git add src/routing.ts src/routing.test.ts src/RouteControls.tsx \
  src/RouteControls.test.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add phone destination controls"
```

### Task 3: Manage active navigation and continuous SDK location

**Files:**
- Create: `src/navigation.ts`
- Create: `src/navigation.test.ts`
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard.test.ts`

- [ ] **Step 1: Write geometry and lifecycle tests**

Test:

```ts
expect(haversineMeters(pointA, pointA)).toBe(0);
expect(distanceToRouteMeters(onRoute, geometry)).toBeLessThan(3);
expect(distanceBucket(187)).toBe(180);
expect(distanceBucket(1240)).toBe(1200);
```

Lifecycle assertions:

```ts
expect(bridge.startAppLocationUpdates).toHaveBeenCalledWith({
  accuracy: AppLocationAccuracy.Medium,
  intervalMs: 2000,
  distanceFilter: 5,
});
expect(bridge.stopAppLocationUpdates).toHaveBeenCalledTimes(1);
expect(unsubscribeLocation).toHaveBeenCalledTimes(1);
```

Three consecutive fixes more than 35 meters off-route request one reroute; a
30-second cooldown and one-in-flight guard prevent duplicates.

Cache tests must also assert an active destination and route summary survive a
reload as `stale`, but continuous location does not restart automatically.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run src/navigation.test.ts src/live-dashboard.test.ts
```

- [ ] **Step 3: Implement navigation geometry**

Export:

```ts
export function haversineMeters(a: Coordinate, b: Coordinate): number;
export function distanceToRouteMeters(
  point: Coordinate,
  geometry: readonly Coordinate[],
): number;
export function distanceBucket(distance: number): number;
export function selectActiveManeuver(
  route: RouteValue,
  location: Coordinate,
): number;
```

Use 10-meter buckets below 200 meters, 50-meter buckets below one kilometer,
and 100-meter buckets above one kilometer.

- [ ] **Step 4: Implement the navigation session**

Export:

```ts
export type NavigationBridge = LocationBridge & {
  startAppLocationUpdates(options?: AppLocationOptions): Promise<boolean>;
  stopAppLocationUpdates(): Promise<boolean>;
  onAppLocationChanged(listener: (location: AppLocation) => void): () => void;
};

export function createNavigationSession(options: {
  bridge: NavigationBridge;
  route: RouteValue;
  destination: Destination;
  onUpdate(update: LiveDashboardUpdate): void;
  reroute(start: Coordinate, destination: Destination): Promise<RouteValue>;
  now?: () => number;
}): {
  start(): Promise<void>;
  stop(): Promise<void>;
};
```

On each valid fix:

- persist only the latest fix;
- update the right tiles only when maneuver index or distance bucket changes;
- update left tiles after at least 15 meters of movement or a maneuver change;
- call `resolveMap()` only after `clientMapCell()` changes, coalescing its
  eventual map update with any pending left refresh;
- combine simultaneous left/right changes as `all`;
- reroute after three consecutive fixes over 35 meters away, at least 30
  seconds after the last reroute, with only one request in flight.

`stop()` unsubscribes before awaiting `stopAppLocationUpdates()` and is
idempotent.

- [ ] **Step 5: Connect route start/end to the dashboard**

Add dashboard methods:

```ts
startRoute(destination: Destination, profile: RouteProfile): Promise<void>;
endRoute(): Promise<void>;
```

`startRoute()` uses the newest resolved location, requests a route, sets route
status to `fresh`, emits `all`, then starts navigation updates. `endRoute()`
stops location updates, clears route geometry, returns to enabled-ready state,
and emits `all`.

Before route actions, synchronize the dashboard route state with the startup
routing status: `disabled` when no key is configured, otherwise `fresh` with no
route value. If a start or reroute request fails, retain the last safe geometry as `stale`. Stop automatic reroute attempts until the next valid fix/cooldown. Keep end/retry actions available.

App cleanup must call `endRoute()` before disposing the live dashboard.

Persist this bounded record under `relic:active-route:v1`:

```ts
type ActiveRouteCache = {
  readonly destination: Destination;
  readonly route: RouteValue;
  readonly fetchedAt: number;
};
```

On successful route start or reroute, overwrite the record. On end, call
`clearCache(storage, "active-route")`. During dashboard startup, restore a valid record younger than six hours as route status `stale`. Emit `all`. Require an explicit new start action before continuous location begins.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run src/navigation.test.ts src/live-dashboard.test.ts
git add src/navigation.ts src/navigation.test.ts src/live-dashboard.ts \
  src/live-dashboard.test.ts
git commit -m "feat: track active ORS navigation"
```

### Task 4: Render routing states and maneuvers

**Files:**
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-canvas-hud.test.ts`

- [ ] **Step 1: Write state rendering tests**

Assert exact navigation labels:

```ts
disabled -> ["NAV // READY", "Route key required", "Use after ORS connection"]
enabled idle -> ["NAV // READY", "Select destination"]
loading -> ["NAV // ROUTING", "Calculating route"]
active -> ["NAV // ACTIVE", "120m", "Turn right"]
stale -> ["NAV // STALE", "Route confirmation required"]
```

Assert active geometry is overlaid above base roads and ending navigation
removes it.

- [ ] **Step 2: Run and verify RED**

```bash
npx vitest run src/fast-canvas-hud.test.ts
```

- [ ] **Step 3: Render normalized route state**

Change `drawNavigation()` to accept `DataState<RouteValue>`. Use the current
maneuver instruction and bucketed remaining distance. Keep the approved arrow,
28-pixel distance, 24-pixel instruction, lower card, frames, and page order.

For long Korean instructions, reuse `truncateHudTitle()` with a 16-unit limit.
Do not fetch, calculate distance, or select maneuvers inside the renderer.

- [ ] **Step 4: Full verification and commit**

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
git grep -n "ORS_API_KEY" -- src app.json package.json
```

Expected: all verification passes and the secret-name grep has no client
matches.

```bash
git add src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts
git commit -m "feat: render optional route guidance"
```

### Task 5: Verify disabled and enabled hardware states

**Files:**
- Create: `docs/hardware/2026-07-27-optional-ors-routing.md`

- [ ] **Step 1: Verify without a key**

Start the server without `ORS_API_KEY` and open:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=ors-optional-015
```

Confirm location, weather, RSS, and OSM remain live. Only the navigation page
shows `path key required`. The phone shows no destination input.

- [ ] **Step 2: Verify with a key**

Set `ORS_API_KEY` only in the local server process environment, restart the
server, select a Korean destination in the phone WebView, and confirm:

- destination results appear;
- the route is visible on the left map;
- the next maneuver and distance are visible on the navigation page;
- normal fixes do not send at two-second GPS frequency;
- an actual movement/maneuver change sends the expected tile region;
- ending navigation stops updates and removes the route.

- [ ] **Step 3: Record and commit**

Record both configurations without recording the key:

```bash
git add docs/hardware/2026-07-27-optional-ors-routing.md
git commit -m "docs: verify optional ORS routing on G2"
```

- [ ] **Step 4: Final roadmap verification**

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
git status --short
```

Expected: all commands pass and the worktree contains no uncommitted
implementation changes.

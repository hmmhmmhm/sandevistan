# G2 Balanced OSM Labels Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collision-limited set of Korean OSM place, station, landmark, and road names to the proven G2 tactical map.

**Architecture:** The bounded same-origin map endpoint extends its fixed
Overpass query and normalized response with at most 24 label candidates. The client validates and caches the labelled contract under a new key. A pure Canvas layout module projects, truncates, and collision-filters at most 10 labels. The renderer then draws the route and position layers.

**Tech Stack:** OpenStreetMap, Overpass QL, Sites Worker, TypeScript, Canvas 2D, Vitest, Node test runner

**Execution selection:** Inline execution by the primary agent, without
subagents. Every test command is explicitly serial.

---

### Task 1: Record the proven road-only G2 baseline

**Files:**
- Create: `docs/hardware/2026-07-27-keyless-osm-map.md`
- Modify: `docs/superpowers/plans/2026-07-27-g2-keyless-osm-map.md`

- [x] **Step 1: Write the physical checkpoint record**

Record:

```markdown
# G2 Keyless OSM Map Success

Date: 2026-07-27
Branch: `feature/g2-fast-content`
Tested commit: `72ebbce825e1df3d52612215ddd269b59bc38013`
SDK: `0.0.11`
Build: `live-map-014`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-map-014`
Result: PASS

The user confirmed that the live road geometry was clearly visible:

> Yes, it looks good.

The user also observed that nearby names were absent. That is the expected
scope of `live-map-014`, whose implementation plan explicitly excluded street
labels. Labels move to the separately approved `map-labels-015` design.
```

Do not infer a physical `2/4` trace, cache-cell request count, exact heading,
or unchanged scroll timing from the short confirmation. List those conditions
only as automated evidence.

- [x] **Step 2: Mark the road-only physical plan complete**

Change the three Task 4 checkboxes in
`docs/superpowers/plans/2026-07-27-g2-keyless-osm-map.md` to `[x]`.

- [x] **Step 3: Check and commit the record**

Run:

```bash
git diff --check
git add docs/hardware/2026-07-27-keyless-osm-map.md \
  docs/superpowers/plans/2026-07-27-g2-keyless-osm-map.md
git commit -m "docs: verify keyless OSM map on G2"
```

Expected: no whitespace errors and one documentation commit.

### Task 2: Normalize bounded OSM label candidates on the server

**Files:**
- Modify: `tests/map-api.test.mjs`
- Modify: `server/map.js`

- [x] **Step 1: Write failing query and normalization tests**

Extend the Overpass fixture with:

```js
{
  type: "node",
  lat: 37.5572,
  lon: 126.9245,
  tags: {
    railway: "station",
    name: "Hongik University",
    "name:ko": "Hongik University Station",
  },
},
{
  type: "node",
  lat: 37.5568,
  lon: 126.923,
  tags: {
    leisure: "park",
    name: "Gyeongui Line Forest Road",
  },
}
```

Add a Korean name to the existing primary road:

```js
tags: {
  highway: "primary",
  name: "Yanghwa-ro",
  "name:ko": "Yanghwa-ro",
}
```

Assert the response adds:

```js
labels: [
  {
    kind: "transit",
    name: "Hongik University Station",
    point: [37.5572, 126.9245],
  },
  {
    kind: "road",
    name: "Yanghwa-ro",
    point: [37.56, 126.92],
  },
  {
    kind: "landmark",
    name: "Gyeongui Line Forest Road",
    point: [37.5568, 126.923],
  },
],
```

Assert the generated query contains the fixed road selector and one combined
named-feature selector:

```text
way["highway"]
nwr["name"][~"^(railway|public_transport|place|leisure|tourism|amenity)$"~"^(station|halt|city|town|village|suburb|quarter|neighbourhood|locality|square|park|garden|stadium|museum|attraction|gallery|hospital|university|school|library|marketplace|townhall)$"]
```

Also test:

- `name:ko` wins over `name`;
- control characters and repeated whitespace are removed;
- duplicate names collapse case-insensitively;
- transit precedes place, major road, landmark, and minor road;
- invalid anchors are dropped;
- names are limited to 40 Unicode code points;
- at most 24 labels are returned.

- [x] **Step 2: Run the server label test and verify RED**

Run:

```bash
node --test --test-concurrency=1 tests/map-api.test.mjs
```

Expected: FAIL because the response has no `labels` property and the query has
no named-feature selectors.

- [x] **Step 3: Extend the fixed Overpass query**

Change `buildOverpassQuery()` to produce one fixed query:

```js
export function buildOverpassQuery(latitude, longitude) {
  const around = `(around:${MAP_RADIUS_METERS},${latitude},${longitude})`;
  return [
    "[out:json][timeout:8];",
    `way["highway"]${around}->.roads;`,
    `nwr["name"][~"^(railway|public_transport|place|leisure|tourism|amenity)$"` +
      `~"^(station|halt|city|town|village|suburb|quarter|neighbourhood|locality|square|park|garden|stadium|museum|attraction|gallery|hospital|university|school|library|marketplace|townhall)$"]${around}->.named;`,
    ".roads out geom;",
    ".named out center;",
  ].join("");
}
```

The endpoint still accepts only coordinates; callers cannot alter selectors.
The combined selector preserves the approved allowlist while avoiding six
repeated spatial-index scans. The repeated-selector form returned a real
Overpass 504 for the Hongdae cell; this form returned HTTP 200 with the same
bounded feature set.

- [x] **Step 4: Add name, anchor, kind, and priority helpers**

In `server/map.js`, define:

```js
const MAX_LABELS = 24;
const MAX_LABEL_CODE_POINTS = 40;

function normalizedName(tags) {
  const raw = tags?.["name:ko"] ?? tags?.name;
  if (typeof raw !== "string") return null;
  const clean = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return [...clean].slice(0, MAX_LABEL_CODE_POINTS).join("");
}
```

Resolve an anchor in this order:

1. node `lat` and `lon`;
2. element `center.lat` and `center.lon`;
3. the middle finite geometry point.

Classify named elements:

```js
function labelKind(element, road) {
  if (
    ["station", "halt"].includes(element?.tags?.railway)
    || element?.tags?.public_transport === "station"
  ) return { kind: "transit", priority: 0 };
  if (typeof element?.tags?.place === "string") {
    return { kind: "place", priority: 1 };
  }
  if (road?.kind === "major") return { kind: "road", priority: 2 };
  if (
    element?.tags?.leisure
    || element?.tags?.tourism
    || element?.tags?.amenity
  ) return { kind: "landmark", priority: 3 };
  if (road) return { kind: "road", priority: 4 };
  return null;
}
```

Sort by priority then source order, deduplicate with
`name.toLocaleLowerCase("ko-KR")`, and return the first 24 without exposing
priority.

- [x] **Step 5: Version the server cache and return labels**

Change the internal cache request path from `roads` to
`roads-labels-v2`. Extend `normalizeMapPayload()` to return:

```js
return {
  cell,
  attribution: "© OSM CONTRIBUTORS",
  roads,
  labels,
};
```

Keep the 180-road, 4,000-point, one-megabyte, and timeout limits unchanged.

- [x] **Step 6: Run serial server tests and commit**

Run in order:

```bash
node --test --test-concurrency=1 tests/map-api.test.mjs
node --test --test-concurrency=1 tests/news-api.test.mjs
node --test --test-concurrency=1 tests/api-router.test.mjs
node scripts/prepare-sites-build.mjs
node --test --test-concurrency=1 tests/sites-worker.test.mjs
```

Expected: every command exits 0.

Commit:

```bash
git add server/map.js tests/map-api.test.mjs
git commit -m "feat: normalize bounded OSM labels"
```

### Task 3: Validate and cache the labelled client contract

**Files:**
- Modify: `src/live-state.ts`
- Modify: `src/live-state.test.ts`
- Modify: `src/map.ts`
- Modify: `src/map.test.ts`
- Modify: `src/live-dashboard.test.ts`
- Modify: `src/live-dashboard-map.test.ts`

- [x] **Step 1: Write failing map-label parser tests**

Add:

```ts
expect(parseMapResponse({
  cell: "37.555,126.920",
  attribution: "© OSM CONTRIBUTORS",
  roads: [],
  labels: [{
    kind: "transit",
    name: "Hongik University Station",
    point: [37.5572, 126.9245],
  }],
}).labels[0]).toEqual({
  kind: "transit",
  name: "Hongik University Station",
  point: {
    latitude: 37.5572,
    longitude: 126.9245,
  },
});
```

Assert parsing throws for:

- missing `labels`;
- an unsupported kind;
- an empty or longer-than-40-code-point name;
- an invalid coordinate;
- 25 labels.

Change cache assertions from `relic:map:v1` to
`relic:map-labels:v1`. Add a road-only old cache under `relic:map:v1` and
assert that it is ignored and a network request occurs.

- [x] **Step 2: Run client map tests and verify RED**

Run:

```bash
npx vitest run src/map.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `MapValue` and `parseMapResponse()` have no label
contract and the cache key remains `map`.

- [x] **Step 3: Add the shared label types and initial value**

In `src/live-state.ts`, add:

```ts
export type MapLabel = {
  readonly kind: "place" | "transit" | "landmark" | "road";
  readonly name: string;
  readonly point: Coordinate;
};
```

Require labels in `MapValue`:

```ts
export type MapValue = {
  readonly roads: readonly MapRoad[];
  readonly labels: readonly MapLabel[];
  readonly attribution: "© OSM CONTRIBUTORS";
  readonly cell?: string;
};
```

Set `labels: []` in `createInitialLiveDashboardState()` and its unit test.

- [x] **Step 4: Parse, validate, and clone labels**

In `src/map.ts`, define:

```ts
const MAP_MAX_LABELS = 24;
const MAP_MAX_LABEL_CODE_POINTS = 40;
const MAP_CACHE_KEY = "map-labels";
const MAP_LABEL_KINDS = new Set([
  "place",
  "transit",
  "landmark",
  "road",
]);
```

Parse every normalized label into `MapLabel`, requiring:

- one allowed kind;
- a trimmed non-empty name of at most 40 code points;
- a two-number coordinate within geographic bounds.

Include labels in `isMapValue()`, `cloneMapValue()`, and
`parseMapResponse()`. Read and write `MAP_CACHE_KEY` instead of `map`.

- [x] **Step 5: Update session fixtures without changing transport**

Add `labels: []` to every normalized map fixture in:

- `src/live-dashboard.test.ts`;
- `src/live-dashboard-map.test.ts`;
- `src/map.test.ts`.

Do not change `refreshMap()` or its `"left"` target.

- [x] **Step 6: Run serial client tests and commit**

Run in order:

```bash
npx vitest run src/live-state.test.ts --no-file-parallelism --maxWorkers=1
npx vitest run src/map.test.ts --no-file-parallelism --maxWorkers=1
npx vitest run src/live-dashboard.test.ts --no-file-parallelism --maxWorkers=1
npx vitest run src/live-dashboard-map.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: every command exits 0.

Commit:

```bash
git add src/live-state.ts src/live-state.test.ts src/map.ts src/map.test.ts \
  src/live-dashboard.test.ts src/live-dashboard-map.test.ts
git commit -m "feat: cache labelled OSM maps"
```

### Task 4: Build deterministic collision-limited label layout

**Files:**
- Create: `src/map-label-layout.ts`
- Create: `src/map-label-layout.test.ts`

- [x] **Step 1: Write failing pure layout tests**

Test:

```ts
const labels = layoutMapLabels(
  Array.from({ length: 14 }, (_, index) => ({
    kind: index === 0 ? "transit" : "road",
    name: index === 0 ? "Hongik University Station": `Road ${index}`,
    point: {
      latitude: 37.55 + index * 0.0005,
      longitude: 126.91 + index * 0.0005,
    },
  })),
  { latitude: 37.5563, longitude: 126.922 },
);

expect(labels).toHaveLength(10);
expect(labels[0]).toMatchObject({
  kind: "transit",
  text: "Hongik University Station",
  fontSize: 9,
});
```

Also assert:

- every box stays within `x=18..270`, `y=34..244`;
- accepted boxes do not overlap after four-pixel expansion;
- no box intersects the arrow exclusion rectangle
  `x=128..160`, `y=126..162`;
- transit and place candidates win collisions against road and landmark
  candidates;
- long mixed-width names end with `…` and fit their unit limit;
- the same input produces identical output.

- [x] **Step 2: Run layout tests and verify RED**

Run:

```bash
npx vitest run src/map-label-layout.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `src/map-label-layout.ts` does not exist.

- [x] **Step 3: Implement display-unit truncation and width estimation**

Export:

```ts
export const MAX_VISIBLE_MAP_LABELS = 10;

export type PositionedMapLabel = {
  readonly kind: MapLabel["kind"];
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: 8 | 9;
};
```

Count ASCII as one display unit and other code points as two. Use 16 units for
`transit` and `place`, 14 for `road` and `landmark`, reserving two units for
the ellipsis. Estimate width as:

```ts
const width = [...text].reduce(
  (sum, character) =>
    sum + (/^[\x00-\x7F]$/.test(character) ? 5 : fontSize),
  0,
);
```

- [x] **Step 4: Implement priority, projection, bounds, and collision**

Sort a copied candidate list by:

```ts
const PRIORITY = {
  transit: 0,
  place: 1,
  road: 2,
  landmark: 3,
} as const;
```

Project with `projectCoordinate()`. Center each label at its anchor. Clamp the visible rectangle to the viewport. Reject the label if its four-pixel-expanded collision box intersects an accepted box or the following region:

```ts
const ARROW_EXCLUSION = {
  left: 128,
  top: 126,
  right: 160,
  bottom: 162,
};
```

Stop at 10 accepted labels.

- [x] **Step 5: Run the pure tests and commit**

Run:

```bash
npx vitest run src/map-label-layout.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: both commands exit 0.

Commit:

```bash
git add src/map-label-layout.ts src/map-label-layout.test.ts
git commit -m "feat: lay out collision-safe OSM labels"
```

### Task 5: Paint map labels without changing fast transport

**Files:**
- Modify: `src/fast-map.ts`
- Modify: `src/fast-map.test.ts`
- Modify: `src/fast-canvas-hud.test.ts`

- [x] **Step 1: Write failing Canvas order and style tests**

Extend the test context to record ordered `fillRect`, `fillText`, `stroke`, and
polygon `fill` operations. Given transit, road, and colliding labels, assert:

```ts
expect(labelTexts).toContain("Hongik University Station");
expect(labelTexts.length).toBeLessThanOrEqual(10);
expect(roadStrokeOrder).toBeLessThan(firstLabelOrder);
expect(lastLabelOrder).toBeLessThan(routeStrokeOrder);
expect(routeStrokeOrder).toBeLessThan(positionFillOrder);
```

Assert that transit/place text uses `#ffffff` with 9px bold font. Assert that road/landmark text uses `#d0d0d0` with 8px bold font. Verify that each label has a black patch immediately before its text.

Retain the existing four-page identical-left-snapshot assertion.

- [x] **Step 2: Run Canvas tests and verify RED**

Run:

```bash
npx vitest run src/fast-map.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because no map labels are painted.

- [x] **Step 3: Paint accepted labels between roads and route**

Import `layoutMapLabels` into `src/fast-map.ts` and add:

```ts
function drawMapLabels(
  context: CanvasRenderingContext2D,
  map: MapValue,
  center: Coordinate,
) {
  for (const label of layoutMapLabels(map.labels, center)) {
    context.fillStyle = COLOR.background;
    context.fillRect(label.x - 2, label.y - 1, label.width + 4, label.height + 2);
    drawText(
      context,
      label.text,
      label.x,
      label.y,
      label.fontSize,
      label.kind === "transit" || label.kind === "place"
        ? COLOR.primary
        : COLOR.secondary,
      "bold",
    );
  }
}
```

Call it after `drawRoads()` and before `drawRoute()`. Do not paint labels for
the schematic fallback.

- [x] **Step 4: Run serial Canvas and transport regression tests**

Run in order:

```bash
npx vitest run src/fast-map.test.ts --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: every command exits 0 and the transport tests retain `3/5/2/4`,
`3/5`, left-only refresh, bilateral output, and double-tap restoration.

- [x] **Step 5: Commit Canvas labels**

Run:

```bash
git add src/fast-map.ts src/fast-map.test.ts src/fast-canvas-hud.test.ts
git commit -m "feat: render balanced OSM labels on G2"
```

### Task 6: Create and verify the physical label build

**Files:**
- Modify: `package.json`
- Modify: `src/sdk-version.test.ts`
- Create: `docs/hardware/2026-07-27-balanced-osm-labels.md`

- [x] **Step 1: Write the failing QR identity assertion**

Change the expected QR script to:

```ts
expect(packageManifest.scripts.qr).toBe(
  'evenhub qr --url "http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-015"',
);
```

Run:

```bash
npx vitest run src/sdk-version.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL while `package.json` still points to `live-map-014`.

- [x] **Step 2: Update and verify the QR build**

Set:

```json
"qr": "evenhub qr --url \"http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-015\""
```

Run:

```bash
npx vitest run src/sdk-version.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 2/2 tests pass.

- [x] **Step 3: Run the complete serial verification gate**

Run these commands one at a time:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 tests/map-api.test.mjs
node --test --test-concurrency=1 tests/news-api.test.mjs
node --test --test-concurrency=1 tests/api-router.test.mjs
git diff --check
```

Expected: every command exits 0.

- [x] **Step 4: Verify the live Tailscale endpoint**

Restart Vite on port 4176. Run:

```bash
curl -sS --max-time 20 \
  "http://100.96.68.73:4176/api/map?lat=37.5563&lng=126.922" \
  | jq '{cell, roadCount:(.roads|length), labels}'
```

Expected: the response contains a valid cell, roads, and no more than 24 labels. If OSM supplies a named candidate for the test cell, the response includes at least one.

- [x] **Step 5: Commit the physical build identity**

Run:

```bash
git add package.json src/sdk-version.test.ts
git commit -m "chore: point QR to labelled OSM build"
```

- [x] **Step 6: Open and verify on G2**

Open:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-015
```

Ask the user to confirm:

- nearby Korean names are recognizable and readable;
- the label density is not distracting;
- route/position layers remain visually dominant;
- bilateral output and page speed are unchanged;
- double-tap hide/restore still works.

- [x] **Step 7: Record the labelled physical checkpoint**

After confirmation, create
`docs/hardware/2026-07-27-balanced-osm-labels.md`. Separate the user's visible
observations from automated-only transport evidence.

Commit:

```bash
git add docs/hardware/2026-07-27-balanced-osm-labels.md
git commit -m "docs: verify balanced OSM labels on G2"
```

### Task 7: Scale label type for physical readability

**Files:**
- Modify: `src/map-label-layout.ts`
- Modify: `src/map-label-layout.test.ts`
- Modify: `src/fast-map.test.ts`
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Modify: `docs/hardware/2026-07-27-balanced-osm-labels.md`

- [x] **Step 1: Write failing 1.5x font assertions**

Change the pure layout expectations to:

```ts
expect(transit).toMatchObject({ fontSize: 14 });
expect(road).toMatchObject({ fontSize: 12 });
```

Change the Canvas font expectations to `bold 14px` and `bold 12px`.

- [x] **Step 2: Run serial focused tests and verify RED**

Run separately:

```bash
npx vitest run src/map-label-layout.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-map.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: both fail on the old 9px/8px sizes.

- [x] **Step 3: Scale layout fonts and collision geometry**

Change `PositionedMapLabel["fontSize"]` to `12 | 14`. Use:

```ts
const fontSize = prominent ? 14 : 12;
```

Keep the same display-unit limits, `height = fontSize + 2`, viewport clamp,
four-pixel collision expansion, arrow exclusion, and 10-label maximum.
Scale the ASCII width estimate from 5px at the original 8px font to 8px at the new 12px font.
The collision calculation must use the new rendered size for Latin fallback names. The existing full-width estimate automatically responds to
the larger font dimensions.

- [x] **Step 4: Verify the scaled Canvas**

Run separately:

```bash
npx vitest run src/map-label-layout.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-map.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: every command exits 0.

- [x] **Step 5: Create the revised physical build**

Set the QR identity to:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-large-016
```

Update the SDK identity test first, verify RED, update `package.json`, and
verify 2/2 PASS.

- [x] **Step 6: Run the complete serial gate**

Run one command at a time:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 tests/map-api.test.mjs
git diff --check
```

- [x] **Step 7: Commit and open the revised build**

Commit:

```bash
git add src/map-label-layout.ts src/map-label-layout.test.ts \
  src/fast-map.test.ts src/sdk-version.test.ts package.json \
  docs/hardware/2026-07-27-balanced-osm-labels.md \
  docs/superpowers/specs/2026-07-27-g2-osm-labels-design.md \
  docs/superpowers/plans/2026-07-27-g2-balanced-osm-labels.md
git commit -m "feat: enlarge OSM labels for G2"
```

Open:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=map-labels-large-016
```

- [x] **Step 8: Record final physical approval**

After user confirmation, change Stage 2 in
`docs/hardware/2026-07-27-balanced-osm-labels.md` from `PENDING` to the exact
observed result. Separate physical observations from automated-only evidence,
then commit the record.

# G2 Fast Transport Default Promotion Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make four-call image transmission and four-level content PNGs the query-free `/hud-canvas-fast` defaults. Bypass redundant palette work for black hide frames. Preserve explicit serial/original rollback.

**Architecture:** Query resolvers own the route defaults and retain explicit rollback values. The existing local `refreshImages` function accepts a per-call palette mode, so only the hidden-frame call overrides the content default. Package scripts, durable repository guidance, and hardware records expose the new default and preserve every historical experiment URL.

**Tech Stack:** TypeScript, React, Canvas 2D, Vitest/jsdom, Vite, Even Hub SDK `0.0.11`

---

### Task 1: Promote route-level resolver defaults

**Files:**
- Modify: `src/image-send-concurrency.ts:1-11`
- Modify: `src/image-send-concurrency.test.ts:1-17`
- Modify: `src/g2-tile-palette.ts:1-9`
- Modify: `src/g2-tile-palette.test.ts:9-19`
- Modify: `src/App.test.tsx:252-320`

- [x] **Step 1: Write failing resolver tests**

Replace the concurrency cases with:

```ts
it.each([
  ["", 4],
  ["?pipeline=1", 1],
  ["?pipeline=2", 2],
  ["?pipeline=3", 3],
  ["?pipeline=4", 4],
  ["?pipeline=0", 4],
  ["?pipeline=5", 4],
  ["?pipeline=two", 4],
])("resolves %s to %i", (search, expected) => {
  expect(resolveImageSendConcurrency(search)).toBe(expected);
});
```

Replace the palette resolver cases with:

```ts
it.each([
  ["", "hud-4"],
  ["?levels=4", "hud-4"],
  ["?pipeline=4&levels=4", "hud-4"],
  ["?levels=original", "original"],
  ["?levels=8", "hud-4"],
  ["?levels=04", "hud-4"],
  ["?levels=bad", "hud-4"],
])("resolves %s to %s", (search, expected) => {
  expect(resolveG2TilePaletteMode(search)).toBe(expected);
});
```

Update the invalid-pipeline App test to expect four, rename it to
`uses the four-call default for an invalid pipeline`, and replace the palette
default test expectation with `"hud-4"`.

Add one explicit rollback App test:

```ts
it("passes the explicit serial and original rollback", async () => {
  window.history.replaceState(
    {},
    "",
    "/hud-canvas-fast?pipeline=1&levels=original",
  );
  mocks.transmitFast.mockResolvedValue(vi.fn());

  render(<App />);

  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());
  expect(fastOptions().imageSendConcurrency).toBe(1);
  expect(fastOptions().tilePaletteMode).toBe("original");
});
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/image-send-concurrency.test.ts \
  src/g2-tile-palette.test.ts src/App.test.tsx \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because missing and invalid queries still resolve to serial and
original.

- [x] **Step 3: Implement the new resolver defaults**

Implement concurrency resolution as:

```ts
export function resolveImageSendConcurrency(
  search: string,
): ImageSendConcurrency {
  const value = new URLSearchParams(search).get("pipeline");
  if (value === "1") return 1;
  if (value === "2") return 2;
  if (value === "3") return 3;
  return 4;
}
```

Implement palette resolution as:

```ts
export function resolveG2TilePaletteMode(search: string): G2TilePaletteMode {
  return new URLSearchParams(search).get("levels") === "original"
    ? "original"
    : "hud-4";
}
```

- [x] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command.

Expected: all resolver and App option tests pass.

- [x] **Step 5: Commit the resolver promotion**

```bash
git add src/image-send-concurrency.ts src/image-send-concurrency.test.ts \
  src/g2-tile-palette.ts src/g2-tile-palette.test.ts src/App.test.tsx
git commit -m "feat: promote fast G2 route defaults"
```

### Task 2: Bypass palette processing for black hide frames

**Files:**
- Modify: `src/fast-canvas-transport.ts:136-166,324-344`
- Modify: `src/glasses.test.ts:20-190,1425-1470`

- [x] **Step 1: Extend the test harness and write the failing hide test**

Add to `FastRefreshHarnessConfig`:

```ts
readonly tilePaletteMode?: "original" | "hud-4";
```

Capture the fourth encoder argument:

```ts
const encodedPaletteModes: Array<"original" | "hud-4" | undefined> = [];

encode: async (
  source,
  _factory,
  tiles = module.G2_TILES,
  options,
) => {
  encodedPaletteModes.push(options?.paletteMode);
  // retain the existing ID, source, attempt, and payload behavior
},
```

Pass the configured mode to `transmitFastCanvas`, return
`encodedPaletteModes` from the harness, and add:

```ts
it("bypasses the content palette only for black hide frames", async () => {
  const harness = await createFastRefreshHarness({
    tilePaletteMode: "hud-4",
  });

  expect(harness.encodedPaletteModes).toEqual(["hud-4"]);

  harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
  await vi.waitFor(() => {
    expect(harness.encodedPaletteModes).toEqual(["hud-4", "original"]);
  });
  expect(harness.encodedSources).toEqual(["hud", "black"]);

  harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
  await vi.waitFor(() => {
    expect(harness.encodedPaletteModes).toEqual([
      "hud-4",
      "original",
      "hud-4",
    ]);
  });
  expect(harness.encodedSources).toEqual(["hud", "black", "hud"]);
});
```

- [x] **Step 2: Run the focused transport test and verify RED**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because hide still receives `"hud-4"`.

- [x] **Step 3: Add a per-refresh encoding-mode override**

Extend the local function signature:

```ts
const refreshImages = async (
  imageSource: HTMLCanvasElement,
  targetTiles: readonly Tile[],
  completionMessage: string,
  shouldContinue: () => boolean = () => true,
  encodingPaletteMode: G2TilePaletteMode = tilePaletteMode,
) => {
```

Pass the local mode to the encoder and diagnostics:

```ts
{ paletteMode: encodingPaletteMode }
formatG2TileEncodingDiagnostic(encodedTiles, encodingPaletteMode)
```

Change only the hide call:

```ts
await refreshImages(
  hiddenSource ??= displayToggle.createHiddenSource(),
  tiles,
  "HUD hidden",
  undefined,
  "original",
);
```

No other refresh call receives an override.

- [x] **Step 4: Run the focused transport test and verify GREEN**

Run the Step 2 command.

Expected: all transport tests pass, with content/hide/restore modes exactly
`hud-4 → original → hud-4`.

- [x] **Step 5: Commit the hide-path refinement**

```bash
git add src/fast-canvas-transport.ts src/glasses.test.ts
git commit -m "perf: bypass palette work for hidden G2 frames"
```

### Task 3: Publish the query-free default and rollback contract

**Files:**
- Modify: `package.json:13-21`
- Modify: `src/sdk-version.test.ts:6-62`
- Modify: `README.md:20-30,56-64,145-166,370-385`
- Modify: `AGENTS.md:28-34,44-52,60-72`
- Modify: `docs/superpowers/specs/2026-07-31-g2-fast-transport-default-promotion-design.md:1-10`

- [x] **Step 1: Write failing package-script tests**

Update the primary QR expectation to:

```ts
expect(packageManifest.scripts.qr).toBe(
  'evenhub qr --url "http://100.127.255.11:4177/'
    + 'hud-canvas-fast?sdk=0.0.11&build=fast-default-040"',
);
```

Add:

```ts
expect(scripts["qr:rollback"]).toContain(
  "sdk=0.0.11&pipeline=1&levels=original"
    + "&build=rollback-serial-original-040",
);
expect(scripts["qr:rollback"]).toContain("http://100.127.255.11:4177/");
```

Keep every historical pipeline and palette script assertion.

- [x] **Step 2: Run the SDK test and verify RED**

Run:

```bash
npx vitest run src/sdk-version.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the primary URL is still the historical serial build
and `qr:rollback` does not exist.

- [x] **Step 3: Update package scripts**

Set:

```json
"qr": "evenhub qr --url \"http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040\"",
"qr:rollback": "evenhub qr --url \"http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&levels=original&build=rollback-serial-original-040\""
```

Do not edit the existing `qr:pipeline2`, `qr:pipeline3`, `qr:pipeline4`, or
`qr:palette4` values.

- [x] **Step 4: Update durable project documentation**

Update README transport copy to state:

- the query-free fast route uses four bounded in-flight calls;
- content tiles use the four authored gray levels;
- black hide frames bypass palette conversion;
- rollback is `pipeline=1&levels=original`;
- accepted refreshes remain fail-fast and never queue, merge, replay, or retry;
- the measured restore improvement is 24.8%.

Update contribution rules so they require the bounded four-call default and
explicit rollback rather than serial-by-default transport.

Add an `AGENTS.md` decision that preserves:

- query-free `pipeline=4` and `hud-4` defaults;
- serial/original rollback;
- original encoding for hidden black frames;
- historical experiment URLs and SDK `0.0.11`.

Change the promotion design status to
`Implemented; awaiting default-route physical gate`.

- [x] **Step 5: Run focused SDK and repository checks**

Run serially:

```bash
npx vitest run src/sdk-version.test.ts --no-file-parallelism --maxWorkers=1
npm run test:repo
```

Expected: SDK tests and all five repository-copy tests pass, with no active
copy claiming serial-by-default behavior.

- [x] **Step 6: Commit the published default**

```bash
git add package.json src/sdk-version.test.ts README.md AGENTS.md \
  docs/superpowers/specs/2026-07-31-g2-fast-transport-default-promotion-design.md
git commit -m "docs: publish fast G2 transport default"
```

### Task 4: Verify, package, document, and serve the promotion

**Files:**
- Create: `docs/hardware/2026-07-31-g2-fast-transport-default-promotion.md`
- Modify: `docs/superpowers/plans/2026-07-31-g2-fast-transport-default-promotion.md`

- [x] **Step 1: Run the complete verification suite serially**

Run one command only after the previous command exits:

```bash
npm test
npm run typecheck
npm run test:repo
npm run build
npm run test:sites
npm run pack
```

Expected:

- all source tests pass with one Vitest worker and no file parallelism;
- TypeScript reports no errors;
- repository-copy checks pass;
- production and Sites builds pass;
- four Sites worker tests pass with Node concurrency one;
- `sandevistan.ehpk` is produced with SDK `0.0.11`.

- [x] **Step 2: Create the physical promotion record**

Create an English hardware record with:

```md
# G2 Fast Transport Default Promotion

Date: 2026-07-31

Status: Ready for default-route physical gate

## Default

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040`

## Rollback

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&levels=original&build=rollback-serial-original-040`

## Required evidence

Record startup, five hide/restore cycles, content and black PNG bytes,
palette diagnostics, four-call in-flight logs, binocular completeness,
`sendFailed` or timeout results, and idle responsiveness.
```

Include the already measured 54.4% payload reduction and 24.8% restore
improvement as prior evidence, while leaving the default-route hide bypass
unpassed until physical logs arrive.

- [x] **Step 3: Mark the implementation plan complete and commit**

Change every executed checkbox in this plan from `[ ]` to `[x]`, then run:

```bash
git diff --check
git status --short
```

Commit:

```bash
git add docs/hardware/2026-07-31-g2-fast-transport-default-promotion.md \
  docs/superpowers/plans/2026-07-31-g2-fast-transport-default-promotion.md
git commit -m "docs: prepare fast G2 default hardware gate"
```

- [x] **Step 4: Verify the isolated server and push the branch**

Confirm port `4177` is listening from this worktree. Verify both default and
rollback URLs return HTTP 200. Push
`experiment/g2-pipelined-transport` and keep the worktree running.

Do not merge `main` in this task. The written specification requires physical
acceptance of the query-free hide/restore path before fast-forwarding `main`.

# G2 HUD Palette Compression Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in four-level palette for transmitted tiles to reduce G2 PNG payload entropy. Preserve the source Canvas, phone preview, SDK `0.0.11`, and no-queue transport behavior.

**Architecture:** A new pure palette module owns query resolution and RGBA quantization. The existing temporary-tile encoder applies the mode before `toBlob`. The fast-HUD option path carries the resolved mode from `App` to the transport. The transport reports actual encoded byte counts. The stable path remains unmodified when `levels=4` is absent.

**Tech Stack:** TypeScript, React, Canvas 2D, Vitest/jsdom, Vite, Even Hub SDK `0.0.11`

---

### Task 1: Pure palette mode and quantizer

**Files:**
- Create: `src/g2-tile-palette.ts`
- Create: `src/g2-tile-palette.test.ts`

- [x] **Step 1: Write the failing resolver and quantizer tests**

```ts
import { describe, expect, it } from "vitest";
import {
  HUD_FOUR_LEVEL_PALETTE,
  quantizeHudFourLevelPixels,
  resolveG2TilePaletteMode,
} from "./g2-tile-palette";

describe("G2 transmitted-tile palette", () => {
  it.each([
    ["?levels=4", "hud-4"],
    ["?pipeline=4&levels=4", "hud-4"],
    ["", "original"],
    ["?levels=8", "original"],
    ["?levels=04", "original"],
    ["?levels=bad", "original"],
  ] as const)("resolves %s to %s", (search, expected) => {
    expect(resolveG2TilePaletteMode(search)).toBe(expected);
  });

  it("preserves authored HUD palette colors exactly", () => {
    const source = new Uint8ClampedArray(
      HUD_FOUR_LEVEL_PALETTE.flatMap((value) => [value, value, value, 255]),
    );
    expect(quantizeHudFourLevelPixels(source)).toEqual(source);
  });

  it("maps intermediate and colored pixels deterministically", () => {
    const source = new Uint8ClampedArray([
      30, 30, 30, 12,
      100, 100, 100, 64,
      180, 180, 180, 128,
      245, 245, 245, 0,
      255, 0, 0, 255,
    ]);
    expect([...quantizeHudFourLevelPixels(source)]).toEqual([
      0, 0, 0, 255,
      128, 128, 128, 255,
      208, 208, 208, 255,
      255, 255, 255, 255,
      128, 128, 128, 255,
    ]);
    expect([...source]).toEqual([
      30, 30, 30, 12,
      100, 100, 100, 64,
      180, 180, 180, 128,
      245, 245, 245, 0,
      255, 0, 0, 255,
    ]);
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx vitest run src/g2-tile-palette.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `src/g2-tile-palette.ts` does not exist.

- [x] **Step 3: Implement the literal resolver and pure quantizer**

```ts
export type G2TilePaletteMode = "original" | "hud-4";

export const HUD_FOUR_LEVEL_PALETTE = [0, 128, 208, 255] as const;

export function resolveG2TilePaletteMode(search: string): G2TilePaletteMode {
  return new URLSearchParams(search).get("levels") === "4"
    ? "hud-4"
    : "original";
}

function nearestPaletteValue(value: number): number {
  let nearest: number = HUD_FOUR_LEVEL_PALETTE[0];
  let distance = Math.abs(value - nearest);
  for (const candidate of HUD_FOUR_LEVEL_PALETTE.slice(1)) {
    const nextDistance = Math.abs(value - candidate);
    if (nextDistance < distance) {
      nearest = candidate;
      distance = nextDistance;
    }
  }
  return nearest;
}

export function quantizeHudFourLevelPixels(
  source: Uint8ClampedArray,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(source.length);
  for (let index = 0; index < source.length; index += 4) {
    const intensity = Math.round(
      (source[index] * 299
        + source[index + 1] * 587
        + source[index + 2] * 114) / 1000,
    );
    const level = nearestPaletteValue(intensity);
    output[index] = level;
    output[index + 1] = level;
    output[index + 2] = level;
    output[index + 3] = 255;
  }
  return output;
}
```

- [x] **Step 4: Run the focused test and verify it passes**

Run the Step 2 command.

Expected: PASS for all resolver and quantizer cases.

- [x] **Step 5: Commit the pure unit**

```bash
git add src/g2-tile-palette.ts src/g2-tile-palette.test.ts
git commit -m "feat: add G2 tile palette quantizer"
```

### Task 2: Temporary-tile quantization and byte diagnostics

**Files:**
- Modify: `src/g2-canvas.ts:239-271`
- Modify: `src/fast-canvas-transport.ts:95-240`
- Modify: `src/fast-canvas-types.ts:22-31`
- Modify: `src/glasses.test.ts:347-375`

- [x] **Step 1: Write failing encoder-isolation and diagnostic tests**

Add a Canvas test that supplies a temporary tile context with
`getImageData`/`putImageData`, enables `paletteMode: "hud-4"`, and asserts:

```ts
const tilePixels = new Uint8ClampedArray([96, 96, 96, 80]);
const tileSnapshot = tilePixels.slice();
const written: Uint8ClampedArray[] = [];

const tiles = await module.encodeCanvasTiles(
  {} as HTMLCanvasElement,
  canvasFactory,
  [module.G2_TILES[0]],
  { paletteMode: "hud-4" },
);

expect(tiles).toHaveLength(1);
expect([...written[0]]).toEqual([128, 128, 128, 255]);
expect(tilePixels).toEqual(tileSnapshot);
```

The fake `getImageData` returns `tilePixels.slice()`, and `putImageData`
stores another copy in `written`. This proves the encoder mutates only the
temporary `ImageData`, not the supplied source or fixture pixels.

Extend the existing trace test to assert the initial four two-byte harness
payloads are reported exactly:

```ts
expect(trace).toContain(
  "[ENCODE] complete · 4 tiles · palette original"
    + " · bytes 2/2/2/2 · total 8",
);
```

- [x] **Step 2: Run the focused glasses tests and verify failure**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `encodeCanvasTiles` has no palette option and the
diagnostic message has no palette or byte counts.

- [x] **Step 3: Extend the encoder without mutating the source Canvas**

In `src/g2-canvas.ts`, add:

```ts
import {
  quantizeHudFourLevelPixels,
  type G2TilePaletteMode,
} from "./g2-tile-palette";

export type CanvasTileEncodingOptions = {
  readonly paletteMode?: G2TilePaletteMode;
};
```

Extend `encodeCanvasTiles` with a fourth optional argument and, after
`drawImage` but before `toBlob`, apply:

```ts
if (options.paletteMode === "hud-4") {
  const image = context.getImageData(0, 0, tile.width, tile.height);
  image.data.set(quantizeHudFourLevelPixels(image.data));
  context.putImageData(image, 0, 0);
}
```

The source Canvas is only read by `drawImage`; all mutation remains on the
temporary tile Canvas.

- [x] **Step 4: Pass the palette mode into encoding and log real byte counts**

In `src/fast-canvas-types.ts`, import `G2TilePaletteMode` and keep
`TransportDependencies.encode` typed as `typeof encodeCanvasTiles`.

Add a final defaulted `tilePaletteMode: G2TilePaletteMode = "original"`
parameter to `transmitCanvas`. Pass the encoder option:

```ts
encodedTiles = await dependencies.encode(
  imageSource,
  undefined,
  targetTiles,
  { paletteMode: tilePaletteMode },
);
```

Replace the encode-complete message with:

```ts
const encodedByteLengths = encodedTiles.map(({ byteLength }) => byteLength);
logDiagnostic(
  "ENCODE",
  `complete · ${targetTiles.length} tiles`
    + ` · palette ${tilePaletteMode}`
    + ` · bytes ${encodedByteLengths.join("/")}`
    + ` · total ${encodedByteLengths.reduce((sum, value) => sum + value, 0)}`,
  diagnosticDuration(encodeStartedAt),
);
```

Do not change the busy gate, bounded sender, cache, retry, or failure paths.

- [x] **Step 5: Run the focused tests and verify they pass**

Run the Step 2 command.

Expected: PASS with the palette isolation and exact byte diagnostic assertions.

- [x] **Step 6: Commit encoder integration**

```bash
git add src/g2-canvas.ts src/fast-canvas-transport.ts \
  src/fast-canvas-types.ts src/glasses.test.ts
git commit -m "feat: quantize transmitted G2 tiles"
```

### Task 3: Fast-HUD option plumbing and isolated hardware URL

**Files:**
- Modify: `src/App.tsx:1-65`
- Modify: `src/App.test.tsx:15-290`
- Modify: `src/hud-controller-types.ts:1-38`
- Modify: `src/fast-hud-controller.ts:45-70,205-225,430-455`
- Modify: `src/fast-canvas-types.ts:76-94`
- Modify: `src/fast-canvas-session.ts:48-108`
- Modify: `src/glasses.test.ts:20-175`
- Modify: `src/sdk-version.test.ts:26-55`
- Modify: `package.json:15-20`

- [x] **Step 1: Write failing application option tests**

Extend the local `FastTestOptions` with:

```ts
readonly tilePaletteMode?: "original" | "hud-4";
```

Add:

```ts
it("passes the opt-in four-level tile palette to the fast transport", async () => {
  window.history.replaceState(
    {},
    "",
    "/hud-canvas-fast?pipeline=4&levels=4",
  );
  mocks.transmitFast.mockResolvedValue(vi.fn());

  render(<App />);

  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());
  expect(fastOptions().imageSendConcurrency).toBe(4);
  expect(fastOptions().tilePaletteMode).toBe("hud-4");
});

it("keeps the original tile palette by default", async () => {
  window.history.replaceState({}, "", "/hud-canvas-fast?pipeline=4");
  mocks.transmitFast.mockResolvedValue(vi.fn());

  render(<App />);

  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());
  expect(fastOptions().tilePaletteMode).toBe("original");
});
```

Extend the SDK script test:

```ts
expect(scripts["qr:palette4"]).toContain(
  "sdk=0.0.11&pipeline=4&levels=4&build=palette-4-039",
);
expect(scripts["qr:palette4"]).toContain("http://100.127.255.11:4177/");
```

- [x] **Step 2: Run application and SDK tests and verify failure**

Run:

```bash
npx vitest run src/App.test.tsx src/sdk-version.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the palette mode is not resolved or passed and the QR
script does not exist.

- [x] **Step 3: Resolve and carry the palette mode**

In `App.tsx`, resolve once:

```ts
const tilePaletteMode = resolveG2TilePaletteMode(window.location.search);
```

Add `tilePaletteMode` to `UseHudControllerOptions`, its destructuring and
effect dependencies, and the `FastCanvasOptions` call:

```ts
tilePaletteMode,
```

Add the optional field to `FastCanvasOptions`:

```ts
readonly tilePaletteMode?: G2TilePaletteMode;
```

Pass it as the final `transmitCanvas` argument:

```ts
options.imageSendConcurrency ?? 1,
options.tilePaletteMode ?? "original",
```

Startup diagnostics must report both independent settings:

```ts
`transport start · pipeline ${imageSendConcurrency}`
  + ` · palette ${tilePaletteMode}`
```

- [x] **Step 4: Add the hardware QR script**

Add to `package.json`:

```json
"qr:palette4": "evenhub qr --url \"http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&levels=4&build=palette-4-039\""
```

- [x] **Step 5: Run the focused application, SDK, and glasses tests**

Run:

```bash
npx vitest run src/g2-tile-palette.test.ts src/App.test.tsx \
  src/glasses.test.ts src/sdk-version.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: PASS with literal mode resolution, default isolation, encoder option
plumbing, byte diagnostics, and the hardware URL.

- [x] **Step 6: Commit option plumbing**

```bash
git add src/App.tsx src/App.test.tsx src/hud-controller-types.ts \
  src/fast-hud-controller.ts src/fast-canvas-types.ts \
  src/fast-canvas-session.ts src/glasses.test.ts \
  src/sdk-version.test.ts package.json
git commit -m "feat: expose G2 palette compression gate"
```

### Task 4: Repository verification and hardware handoff

**Files:**
- Create: `docs/hardware/2026-07-31-g2-hud-palette-compression.md`
- Modify: `docs/superpowers/specs/2026-07-31-g2-hud-palette-compression-design.md`

- [x] **Step 1: Run the complete verification suite serially**

Run each command only after the previous command finishes:

```bash
npm test
npm run typecheck
npm run test:repo
npm run build
npm run test:sites
npm run pack
```

Expected:

- all Vitest source tests pass with one worker and no file parallelism;
- TypeScript reports no errors;
- repository-copy checks pass;
- Vite and Sites preparation build successfully;
- Sites worker tests pass with Node test concurrency one;
- `sandevistan.ehpk` is produced with SDK `0.0.11`.

- [x] **Step 2: Write the hardware gate record**

Create an English record containing:

```md
# G2 HUD Palette Compression Hardware Gate

Date: 2026-07-31

Status: Ready for physical comparison

## Baseline

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&build=pipeline-4-038`

## Candidate

`http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&levels=4&build=palette-4-039`

## Required evidence

Record total PNG bytes, complete-refresh durations, binocular completeness,
legibility, `sendFailed` or timeout results, and idle responsiveness for the
same serial action sequence.
```

Change the design status to `Implemented; awaiting physical comparison`.

- [x] **Step 3: Verify the final diff and commit**

Run:

```bash
git diff --check
git status --short
```

Expected: only the hardware record and design status are uncommitted.

Commit:

```bash
git add docs/hardware/2026-07-31-g2-hud-palette-compression.md \
  docs/superpowers/specs/2026-07-31-g2-hud-palette-compression-design.md
git commit -m "docs: prepare G2 palette compression hardware gate"
```

- [x] **Step 4: Start and verify the isolated server**

Start the existing experiment worktree on host `0.0.0.0`, port `4177`, then
verify the candidate route returns HTTP 200 and contains the Vite application
shell.

Open:

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=4&levels=4&build=palette-4-039
```

Do not run the baseline and candidate hardware sessions concurrently. The
owner performs one physical action sequence at a time.

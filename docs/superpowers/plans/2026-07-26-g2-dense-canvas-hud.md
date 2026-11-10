# G2 Dense Canvas HUD Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a larger, denser Sandevistan HUD entirely with Canvas primitives and text at `/hud-canvas`, then transmit it through the proven SDK `0.0.10` four-tile path.

**Architecture:** A new pure `src/canvas-hud.ts` module owns the deterministic `576×288` raster composition. `App.tsx` selects it only for `/hud-canvas`; existing image, diagnostic, calibration, and BLE transport code remains unchanged.

**Tech Stack:** React 19, TypeScript, HTML Canvas 2D, Vitest, Testing Library, Vite, Even Hub SDK `0.0.10`

---

## File structure

- Create `src/canvas-hud.ts`: draw panels, map, navigation arrow, sensor data, and labels.
- Create `src/canvas-hud.test.ts`: verify dimensions, palette, fixed panel bounds, paths, and required content.
- Modify `src/App.tsx`: route `/hud-canvas` to the new renderer and existing `transmitCanvas()`.
- Modify `src/App.test.tsx`: verify route label, renderer metadata, and four-container layout.
- Modify `README.md`: document the hardware test URL and preserved baseline paths.

### Task 1: Dense Canvas HUD renderer

**Files:**
- Create: `src/canvas-hud.ts`
- Create: `src/canvas-hud.test.ts`

- [ ] **Step 1: Write the failing renderer test**

Create `src/canvas-hud.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawDenseCanvasHud } from "./canvas-hud";

type Rectangle = {
  style: string;
  args: [number, number, number, number];
};
type TextRecord = {
  style: string;
  value: string;
};
type PathRecord = {
  style: string;
  width: number;
  points: Array<[number, number]>;
};

describe("dense Canvas HUD", () => {
  it("fills the 576 by 288 display with fixed panels and readable mock data", () => {
    const rectangles: Rectangle[] = [];
    const texts: TextRecord[] = [];
    const strokedPaths: PathRecord[] = [];
    const filledPaths: PathRecord[] = [];
    let fillStyle = "";
    let strokeStyle = "";
    let lineWidth = 1;
    let currentPath: Array<[number, number]> = [];

    const context = {
      imageSmoothingEnabled: true,
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
      lineCap: "butt",
      lineJoin: "miter",
      get fillStyle() {
        return fillStyle;
      },
      set fillStyle(value: string | CanvasGradient | CanvasPattern) {
        fillStyle = String(value);
      },
      get strokeStyle() {
        return strokeStyle;
      },
      set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
        strokeStyle = String(value);
      },
      get lineWidth() {
        return lineWidth;
      },
      set lineWidth(value: number) {
        lineWidth = value;
      },
      fillRect: (x: number, y: number, width: number, height: number) => {
        rectangles.push({ style: fillStyle, args: [x, y, width, height] });
      },
      fillText: (value: string) => {
        texts.push({ style: fillStyle, value });
      },
      beginPath: () => {
        currentPath = [];
      },
      moveTo: (x: number, y: number) => {
        currentPath.push([x, y]);
      },
      lineTo: (x: number, y: number) => {
        currentPath.push([x, y]);
      },
      closePath: () => undefined,
      stroke: () => {
        strokedPaths.push({
          style: strokeStyle,
          width: lineWidth,
          points: [...currentPath],
        });
      },
      fill: () => {
        filledPaths.push({
          style: fillStyle,
          width: 0,
          points: [...currentPath],
        });
      },
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;

    drawDenseCanvasHud(canvas);

    const paintedStyles = [
      ...rectangles.map(({ style }) => style),
      ...texts.map(({ style }) => style),
      ...strokedPaths.map(({ style }) => style),
      ...filledPaths.map(({ style }) => style),
    ];

expect(canvas.width).toBe(576);
expect(canvas.height).toBe(288);
expect(rectangles).toEqual(expect.arrayContaining([
  { style: "#000000", args: [0, 0, 576, 288] },
  { style: "#555555", args: [8, 72, 184, 1] },
  { style: "#555555", args: [204, 72, 188, 1] },
  { style: "#555555", args: [404, 72, 164, 1] },
]));
expect(new Set(paintedStyles)).toEqual(new Set([
  "#000000",
  "#ffffff",
  "#aaaaaa",
  "#555555",
]));
expect(texts.map(({ value }) => value)).toEqual(expect.arrayContaining([
  "14:37",
  "HONGDAE",
  "NE 047°",
  "NEXT 120m",
  "right",
  "-24 dBFS",
  "X +0.12",
  "Y -0.03",
  "Z +0.98",
  “At the next intersection”;
  "right",
  "Q. Go to the subway station",
  "NEWS 02",
]));
expect(strokedPaths.length).toBeGreaterThanOrEqual(8);
expect(filledPaths.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run the renderer test and verify RED**

Run:

```bash
npm test -- src/canvas-hud.test.ts
```

Expected: FAIL because `./canvas-hud` does not exist.

- [ ] **Step 3: Implement the renderer**

Create `src/canvas-hud.ts` with:

```ts
const WIDTH = 576;
const HEIGHT = 288;
const COLOR = {
  background: "#000000",
  primary: "#ffffff",
  secondary: "#aaaaaa",
  dim: "#555555",
} as const;

type HudColor = typeof COLOR[keyof typeof COLOR];
type Point = readonly [number, number];

function drawPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = COLOR.dim;
  context.fillRect(x, y, width, 1);
  context.fillRect(x, y + height - 1, width, 1);
  context.fillRect(x, y, 1, height);
  context.fillRect(x + width - 1, y, 1, height);
}

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: HudColor = COLOR.primary,
  weight: "normal" | "bold" = "normal",
) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px "SFMono-Regular", Consolas, monospace`;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(value, x, y);
}

function drawPath(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
  width: number,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "square";
  context.lineJoin = "miter";
  context.stroke();
}

function fillPolygon(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
) {
  const [first, ...rest] = points;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawHeader(context: CanvasRenderingContext2D) {
  drawPanel(context, 8, 8, 132, 54);
  drawText(context, "14:37", 16, 10, 26, COLOR.primary, "bold");
  drawText(context, "HONGDAE", 16, 42, 12, COLOR.secondary, "bold");

  drawPanel(context, 148, 8, 276, 54);
  context.fillStyle = COLOR.secondary;
  context.fillRect(156, 28, 260, 2);
  for (let index = 0; index <= 10; index += 1) {
    const x = 160 + index * 25;
    const height = index % 5 === 0 ? 12 : 6;
    context.fillRect(x, 28 - height, 2, height);
  }
  drawText(context, "N", 206, 38, 11, COLOR.secondary);
  drawText(context, "NE 047°", 278, 37, 13, COLOR.primary, "bold");
  drawText(context, "E", 382, 38, 11, COLOR.secondary);

  drawPanel(context, 432, 8, 136, 54);
  drawText(context, "RELIC // LIVE", 440, 14, 11, COLOR.secondary, "bold");
  for (let index = 0; index < 5; index += 1) {
    context.fillStyle = index < 4 ? COLOR.primary : COLOR.dim;
    context.fillRect(442 + index * 15, 48 - index * 5, 9, 4 + index * 5);
  }
}

function drawMap(context: CanvasRenderingContext2D) {
  drawPanel(context, 8, 72, 184, 172);
  drawText(context, "MAP / 120m", 16, 78, 10, COLOR.secondary, "bold");

  const roads: readonly Point[][] = [
    [[18, 96], [58, 88], [98, 108], [180, 92]],
    [[18, 122], [68, 120], [116, 102], [182, 114]],
    [[18, 150], [62, 142], [98, 158], [182, 146]],
    [[18, 184], [58, 174], [106, 190], [182, 178]],
    [[18, 214], [74, 204], [124, 218], [182, 206]],
    [[38, 84], [42, 236]],
    [[82, 78], [74, 238]],
    [[130, 78], [138, 238]],
  ];
  for (const road of roads) drawPath(context, road, COLOR.dim, 1);

  drawPath(context, [
    [42, 226],
    [60, 196],
    [102, 184],
    [102, 150],
    [154, 150],
    [154, 110],
  ], COLOR.primary, 4);

  fillPolygon(context, [
    [58, 198],
    [70, 226],
    [58, 220],
    [46, 226],
  ], COLOR.primary);
  context.fillStyle = COLOR.primary;
  context.fillRect(149, 105, 12, 12);
  context.fillStyle = COLOR.background;
  context.fillRect(152, 108, 6, 6);

  drawPanel(context, 8, 252, 184, 28);
  drawText(context, "DEST 0.8km", 16, 259, 11, COLOR.primary, "bold");
  drawText(context, "N  ↑", 132, 259, 11, COLOR.secondary);
}

function drawNavigation(context: CanvasRenderingContext2D) {
  drawPanel(context, 204, 72, 188, 130);
  drawText(context, "NEXT 120m", 218, 82, 13, COLOR.secondary, "bold");

  context.fillStyle = COLOR.primary;
  context.fillRect(246, 132, 10, 42);
  context.fillRect(246, 122, 62, 10);
  fillPolygon(context, [
    [308, 108],
    [338, 127],
    [308, 146],
  ], COLOR.primary);
  drawText(context, "turn right", 286, 168, 18, COLOR.primary, "bold");

  drawPanel(context, 204, 214, 188, 66);
  drawText(context, "At the next intersection", 216, 226, 13, COLOR.secondary);
  drawText(context, "Turn right →", 216, 247, 19, COLOR.primary, "bold");
}

function drawSensors(context: CanvasRenderingContext2D) {
  drawPanel(context, 404, 72, 164, 62);
  drawText(context, "MIC", 414, 80, 10, COLOR.secondary, "bold");
  drawText(context, "-24 dBFS", 414, 96, 16, COLOR.primary, "bold");
  for (let index = 0; index < 6; index += 1) {
    const height = [8, 18, 28, 20, 14, 10][index];
    context.fillStyle = index < 4 ? COLOR.primary : COLOR.secondary;
    context.fillRect(490 + index * 11, 124 - height, 7, height);
  }
  context.fillStyle = COLOR.secondary;
  context.fillRect(414, 124, 142, 2);

  drawPanel(context, 404, 142, 164, 80);
  drawText(context, "ACC", 414, 150, 10, COLOR.secondary, "bold");
  drawText(context, "X +0.12", 414, 168, 13, COLOR.primary);
  drawText(context, "Y -0.03", 486, 168, 13, COLOR.primary);
  drawText(context, "Z +0.98", 414, 192, 13, COLOR.primary);
}

function drawQuest(context: CanvasRenderingContext2D) {
  drawPanel(context, 404, 230, 164, 50);
  drawText(context, "Q. Go to subway station", 412, 238, 10, COLOR.primary, "bold");
  drawText(context, "NEWS 02", 492, 258, 11, COLOR.secondary, "bold");
}

export function drawDenseCanvasHud(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas cannot be used.");

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  drawHeader(context);
  drawMap(context);
  drawNavigation(context);
  drawSensors(context);
  drawQuest(context);
}
```

- [ ] **Step 4: Run the renderer test and verify GREEN**

Run:

```bash
npm test -- src/canvas-hud.test.ts
```

Expected: the renderer test passes.

- [ ] **Step 5: Commit the renderer**

```bash
git add src/canvas-hud.ts src/canvas-hud.test.ts
git commit -m "feat: draw dense RELIC HUD on Canvas"
```

### Task 2: `/hud-canvas` route integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write the failing route test**

Add to `src/App.test.tsx`:

```tsx
it("selects the dense Canvas HUD with the proven four-tile layout", () => {
  window.history.replaceState({}, "", "/hud-canvas");
  render(<App autoStart={false} />);

  const hud = screen.getByTestId("hud-frame");
  expect(screen.getByText(/576×288 · CANVAS HUD/)).toBeTruthy();
  expect(hud.dataset.renderer).toBe("canvas");
  expect(hud.dataset.textContainers).toBe("1");
  expect(hud.dataset.imageContainers).toBe("4");
});
```

- [ ] **Step 2: Run the route test and verify RED**

Run:

```bash
npm test -- src/App.test.tsx -t "selects the dense Canvas HUD"
```

Expected: FAIL because `/hud-canvas` still selects the image HUD.

- [ ] **Step 3: Integrate the Canvas renderer**

Modify `src/App.tsx`:

```ts
import { drawDenseCanvasHud } from "./canvas-hud";
```

Add:

```ts
const canvasHudMode = window.location.pathname === "/hud-canvas";
```

Select the renderer before the image fallback:

```ts
if (calibrationMode) {
  drawCalibrationPattern(canvasRef.current!);
} else if (canvasHudMode) {
  drawDenseCanvasHud(canvasRef.current!);
} else {
  await drawHudReference(canvasRef.current!, hudReferenceUrl);
}
```

Add `canvasHudMode` to the effect dependencies. Set the section metadata:

```tsx
data-renderer={canvasHudMode ? "canvas" : calibrationMode ? "calibration" : "image"}
```

Render `576×288 · CANVAS HUD` in the header and
`Send the HUD drawn directly on Canvas to four tiles without the original image.` in the
preview note. Do not change the transport selection: `/hud-canvas` must continue
into `transmitCanvas(canvasRef.current!, report)`.

- [ ] **Step 4: Run route and renderer tests and verify GREEN**

Run:

```bash
npm test -- src/App.test.tsx src/canvas-hud.test.ts
```

Expected: both files pass.

- [ ] **Step 5: Commit route integration**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add dense Canvas HUD route"
```

### Task 3: Documentation and full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the new route**

Add a short section that preserves `/` as the image baseline and identifies
`/hud-canvas` as the dense Canvas experiment. Include:

```text
http://100.96.68.73:4174/hud-canvas?sdk=0.0.10&build=dense-canvas-001
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
git diff --check
```

Expected:

- all Vitest files and tests pass;
- TypeScript exits with code 0;
- Vite build and Sites packaging succeed;
- all four Sites worker tests pass;
- `git diff --check` prints nothing.

- [ ] **Step 3: Commit documentation**

```bash
git add README.md
git commit -m "docs: add dense Canvas HUD hardware test"
```

- [ ] **Step 4: Verify the Tailscale endpoint and generate QR**

Run:

```bash
curl --fail --silent --show-error --output /dev/null \
  --write-out 'HTTP %{http_code}\n' \
  'http://100.96.68.73:4174/hud-canvas?sdk=0.0.10&build=dense-canvas-001'
npx evenhub qr \
  --url 'http://100.96.68.73:4174/hud-canvas?sdk=0.0.10&build=dense-canvas-001' \
  --external
```

Expected: `HTTP 200` and a scannable Even Hub QR.

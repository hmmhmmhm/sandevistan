# G2 Fast Canvas Date and Display Toggle Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Korean full-date header, WebView-only green flat preview, and reversible double-tap black-screen toggle to the fast Canvas HUD.

**Architecture:** Keep the transmitted Canvas palette and fast page contract unchanged. Format the date inside the fast renderer; tint only the browser composition with CSS. Extend the shared image transport with an optional hidden Canvas and before-restore callback. Only `transmitFastCanvas()` toggles four black tiles. Legacy routes retain shutdown behavior.

**Tech Stack:** React 19, TypeScript, Canvas 2D, CSS compositing, `@evenrealities/even_hub_sdk` `0.0.10`, Vitest

---

### Task 1: Korean date header

**Files:**
- Modify: `src/fast-canvas-hud.test.ts`
- Modify: `src/fast-canvas-hud.ts`

- [x] **Step 1: Write the failing date test**

Render `new Date(2026, 6, 27, 14, 37, 42)` and assert:

```ts
expect(hud.values).toEqual(expect.arrayContaining([
  "14:37",
  "2026.07.27 Monday",
  "23°C clear",
  "01 / 04",
]));
expect(hud.texts.find(({ value }) => value === "2026.07.27 Monday")).toMatchObject({
  x: 306,
  y: 40,
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts
```

Expected: FAIL because the date string is absent and weather still includes
`HONGDAE`.

- [x] **Step 3: Implement date formatting and header placement**

Add:

```ts
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "Saturday",
] as const;

function formatDate(now: Date) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join(".");
  return `${date} ${WEEKDAYS[now.getDay()]}`;
}
```

Keep the time at `(306, 12)`, draw the page count at `(516, 18)`, the date at
`(306, 40)`, and `23°C clear` at `(468, 40)`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit the date header**

```bash
git add src/fast-canvas-hud.test.ts src/fast-canvas-hud.ts
git commit -m "feat: add Korean date to fast Canvas header"
```

### Task 2: Flat green WebView preview

**Files:**
- Create: `src/styles.test.mjs`
- Modify: `src/styles.css`

- [x] **Step 1: Write the failing CSS contract test**

Read `src/styles.css` and assert:

```ts
expect(css).toContain(".hud-frame::after");
expect(css).toContain("background: #91ff73");
expect(css).toContain("mix-blend-mode: multiply");
expect(css).toContain("box-shadow: none");
expect(css).not.toContain("radial-gradient");
expect(css).not.toContain("0 0 50px");
```

- [x] **Step 2: Run the CSS test and verify RED**

Run:

```bash
npx vitest run src/styles.test.mjs
```

Expected: FAIL because the overlay and flat styling do not exist.

- [x] **Step 3: Implement preview-only compositing**

Replace the body background with a flat color, make the frame positioned, remove
the glow, and add the noninteractive overlay:

```css
body {
  min-height: 100vh;
  background: #030504;
}

.hud-frame {
  position: relative;
  box-shadow: none;
}

.hud-frame::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #91ff73;
  mix-blend-mode: multiply;
}
```

Do not change any Canvas drawing palette.

- [x] **Step 4: Run CSS and Canvas palette tests and verify GREEN**

Run:

```bash
npx vitest run src/styles.test.mjs src/fast-canvas-hud.test.ts
```

Expected: PASS, including the grayscale Canvas palette assertion.

- [x] **Step 5: Commit the preview treatment**

```bash
git add src/styles.test.mjs src/styles.css
git commit -m "feat: flatten green WebView HUD preview"
```

### Task 3: Double-tap display toggle

**Files:**
- Modify: `src/glasses.test.ts`
- Modify: `src/glasses.ts`
- Modify: `src/App.tsx`

- [x] **Step 1: Write the failing black Canvas test**

Inject a fake canvas factory into a new `createBlackCanvas()` helper and assert:

```ts
expect(canvas.width).toBe(576);
expect(canvas.height).toBe(288);
expect(fillStyle).toBe("#000000");
expect(fills).toEqual([[0, 0, 576, 288]]);
```

- [x] **Step 2: Write the failing fast toggle behavior test**

Call `transmitFastCanvas()` with a marked hidden source and record every encode:

```ts
expect(encodes).toEqual([
  { source: "hud", ids: [2, 3, 4, 5] },
  { source: "black", ids: [2, 3, 4, 5] },
  { source: "hud", ids: [2, 3, 4, 5] },
  { source: "hud", ids: [3, 5] },
]);
expect(shutdownCalls).toBe(0);
expect(navigationCalls).toEqual(["next"]);
expect(beforeRestoreCalls).toBe(1);
```

The sequence is: initial display, double-tap hide, scroll while hidden, double-tap
restore, scroll while visible.

- [x] **Step 3: Write the failing error-state retry test**

Make the first black-tile update fail, then assert a scroll still navigates because
the state stayed visible. Hide successfully, make the first restore fail, assert a
scroll is ignored because the state stayed hidden, and double-tap again to restore.

- [x] **Step 4: Run the transport tests and verify RED**

Run:

```bash
npx vitest run src/glasses.test.ts
```

Expected: FAIL because fast double-tap still calls shutdown and no black Canvas
or visibility state exists.

- [x] **Step 5: Implement a black Canvas factory**

Add:

```ts
export function createBlackCanvas(
  canvasFactory: CanvasFactory = () => document.createElement("canvas"),
) {
  const canvas = canvasFactory();
  canvas.width = 576;
  canvas.height = 288;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot create black Canvas.");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, 576, 288);
  return canvas;
}
```

- [x] **Step 6: Add optional serialized visibility behavior**

Add an optional final `displayToggle` argument to `transmitCanvas()`:

```ts
type DisplayToggle = {
  readonly hiddenSource: HTMLCanvasElement;
  readonly beforeRestore?: () => void | Promise<void>;
};
```

Let `refreshImages()` accept its source Canvas. Replace the navigation-only queue
with one shared operation queue. When `displayToggle` is present:

- double-tap hidden source to all four `tiles`, then set `hidden = true`;
- while hidden, ignore scroll both when queued and when executed;
- next double-tap calls `beforeRestore`, sends the visible source to all four
  tiles, then sets `hidden = false`;
- update state only after all image sends succeed;
- catch and report errors without breaking later queued operations.

When `displayToggle` is absent, keep calling `shutDownPageContainer(1)`.

- [x] **Step 7: Enable the toggle only for fast Canvas**

Extend `FastCanvasOptions`:

```ts
readonly createHiddenSource?: () => HTMLCanvasElement;
readonly beforeRestore?: () => void | Promise<void>;
```

Pass this config from `transmitFastCanvas()`:

```ts
{
  hiddenSource: options.createHiddenSource?.() ?? createBlackCanvas(),
  beforeRestore: options.beforeRestore,
}
```

In `src/App.tsx`, pass `beforeRestore: drawCurrentPage` so restored time and date
are freshly drawn.

- [x] **Step 8: Run focused and full transport tests and verify GREEN**

Run:

```bash
npx vitest run src/glasses.test.ts src/App.test.tsx
```

Expected: PASS. Legacy Canvas shutdown assertions and fast scroll IDs `3, 5`
must remain unchanged.

- [x] **Step 9: Commit the display toggle**

```bash
git add src/glasses.test.ts src/glasses.ts src/App.tsx
git commit -m "feat: toggle fast Canvas display on double tap"
```

### Task 4: Documentation, verification, and hardware handoff

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/hardware/2026-07-26-first-g2-image-success.md`

- [x] **Step 1: Document build `fast-sleep-010`**

Record the date format and the WebView-only green flat preview. Document the black four-tile hide and restore contract and ignored hidden scroll. Record that official SDK sleep is unavailable and legacy shutdown behavior is preserved. Add:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.10&build=fast-sleep-010
```

- [x] **Step 2: Run complete verification**

Run:

```bash
git diff --check
npm test
npm run typecheck
npm run build
npm run test:sites
```

Expected: no whitespace errors; all Vitest, TypeScript, Vite, and four Sites
worker checks pass.

- [x] **Step 3: Commit documentation**

```bash
git add README.md AGENTS.md docs/hardware/2026-07-26-first-g2-image-success.md
git commit -m "docs: prepare fast display toggle hardware test"
```

- [x] **Step 4: Start and verify the isolated server**

Run:

```bash
npm run dev -- --host 0.0.0.0 --port 4176
curl --fail --max-time 5 \
  "http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.10&build=fast-sleep-010"
```

Expected: Vite reports the Tailscale URL and the request returns HTTP 200.

- [x] **Step 5: Preserve the branch for physical testing**

Do not merge or push before G2/R1 confirms hide, hidden-scroll suppression,
restore, date readability, and unchanged page speed.

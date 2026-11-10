# G2 Overview weather auxiliary information readability implementation plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlarge the two lines at the bottom right of `OVERVIEW` for perceived humidity and precipitation and wind to 14px.

**Architecture:** Keep the data flow, position, color, and text of the existing `drawOverview()` unchanged. Adjust only the size argument of the two `drawText()` calls. In the Canvas collection test, assert the actual font strings of both phrases to preserve their sizes.

**Tech Stack:** TypeScript 5.9, Canvas 2D, Vitest

---

### Task 1: Enlarge the two lines of weather information to 14px

**Files:**
- Modify: `src/fast-canvas-hud.test.ts`
- Modify: `src/fast-canvas-hud.ts`

- [x] **Step 1: Write a failure test**

Adds the following tests to the existing real-time weather tests:

```ts
const details = weather.texts.filter(({ value }) =>
  value.startsWith("Feeling ") || value.startsWith("Precipitation ")
);
expect(details).toHaveLength(2);
expect(details.every(({ font }) => /\b14px\b/.test(font))).toBe(true);
```

- [x] **Step 2: Check for failure**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: Since the current font for both phrases is 11px, the `every()` check becomes `false`
It fails.

- [x] **Step 3: Minimal Implementation**

Change the size argument from 11 in both `drawText()` calls in `src/fast-canvas-hud.ts`.
Change to 14.

```ts
drawText(
  context,
  `Feel ${Math.round(weather.apparentTemperature)}° Humidity ${Math.round(weather.humidity)}%`,
  308,
  226,
  14,
  COLOR.secondary,
  "bold",
);
drawText(
  context,
  `Precipitation ${Math.round(weather.precipitationProbability)}% Wind ${Math.round(weather.windSpeed)}km/h`,
  308,
  248,
  14,
  COLOR.primary,
  "bold",
);
```

- [x] **Step 4: Serial Verification**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
npm run build
git diff --check
```

Expected: 10 HUD tests, type checking, 60 module builds and diff checking all in one.
It passes.

- [x] **Step 5: Check commit and server**

```bash
git add src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts \
  docs/superpowers/plans/2026-07-27-g2-overview-weather-legibility.md
git commit -m "style: enlarge overview weather details"
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=detail-decks-019'
```

Expected: A commit is created and the Tailscale URL on the existing single development server is redirected to HTTP
Returns 200.

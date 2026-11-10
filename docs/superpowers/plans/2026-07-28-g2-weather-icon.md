# G2 Weather Icon Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw a large code-driven 1-bit icon for the current Weather dashboard and detail screens.

**Architecture:** Add one focused module that maps Open-Meteo codes to semantic icon kinds and draws geometric Canvas paths. Dashboard and detail renderers call it only when fresh or stale weather data exists; empty-state behavior remains unchanged.

**Tech Stack:** TypeScript, Canvas 2D, Vitest with jsdom, Vite.

---

### Task 1: Weather icon primitive

**Files:**
- Create: `src/fast-weather-icon.ts`
- Create: `src/fast-weather-icon.test.ts`

- [ ] Write a failing test asserting code mappings for sun, partly-cloudy,
  cloud, fog, rain, snow, and thunder.
- [ ] Run
  `npx vitest run src/fast-weather-icon.test.ts --no-file-parallelism --maxWorkers=1`
  and confirm the missing-module failure.
- [ ] Implement `weatherIconKind(code)` and
  `drawFastWeatherIcon(context, code, x, y, size)` with polygonal Canvas paths.
- [ ] Run the focused test and confirm all icon tests pass.
- [ ] Commit with `feat: draw tactical G2 weather icons`.

### Task 2: Dashboard and detail integration

**Files:**
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-canvas-hud.test.ts`
- Modify: `src/fast-detail-hud.ts`
- Modify: `src/fast-detail-hud.test.ts`

- [ ] Add failing renderer assertions for one 72px dashboard icon, one 104px
  detail icon, and no icon in loading or unavailable states.
- [ ] Run both renderer test files serially and confirm icon-call failures.
- [ ] Integrate `drawFastWeatherIcon` and reposition current temperature,
  condition, and metric blocks so no text overlaps the icon.
- [ ] Run focused renderer tests and confirm they pass.
- [ ] Commit with `feat: feature weather icons in G2 HUD`.

### Task 3: Verification and Tailscale deployment

**Files:**
- Modify: `docs/hardware/2026-07-28-g2-weather-dynamic-navigation.md`

- [ ] Run `npm test`.
- [ ] Run `node --test --test-concurrency=1 tests/*.test.mjs`.
- [ ] Run `npm run typecheck`, then `npm run build`.
- [ ] Update the hardware build label to `weather-icon-029`, record test
  counts, and add dashboard/detail icon checks.
- [ ] Run `git diff --check` and verify HTTP 200 at
  `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=weather-icon-029`.
- [ ] Commit the checkpoint without remote git push.

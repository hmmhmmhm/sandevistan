# G2 Live Data Roadmap Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a hardware-verified Sandevistan HUD with keyless location, weather, news, and a local map. Activate OpenRouteService navigation only when a server secret exists.

**Architecture:** Preserve `/hud-canvas-fast`, its `576 x 288` Canvas, and its hardware-required full-frame `3/5/2/4` and page `3/5` image contracts. Execute five independently testable plans in strict order. Each phase leaves the keyless app usable and ends with automated verification. If transport behavior changes, include a physical-G2 checkpoint.

**Tech Stack:** React 19, TypeScript 5.9, Canvas 2D, Even Hub SDK `0.0.11`, Open-Meteo, SBS RSS, OpenStreetMap/Overpass, OpenRouteService, Vite 6, Sites Worker, Vitest, Node test runner

---

## Execution order

1. [`2026-07-27-g2-sdk-0011-hardware-gate.md`](./2026-07-27-g2-sdk-0011-hardware-gate.md)
   Upgrade only the SDK and prove that the current HUD still transmits on the
   physical G2 before any live feature is connected.

2. [`2026-07-27-g2-keyless-location-weather.md`](./2026-07-27-g2-keyless-location-weather.md)
   Add shared live state, cache handling, one-shot phone location, Open-Meteo
   weather, and a coalescing image refresh path.

3. [`2026-07-27-g2-keyless-rss-news.md`](./2026-07-27-g2-keyless-rss-news.md)
   Add the same-origin Worker API framework, an allowlisted SBS feed, resilient
   RSS parsing, persistence, and six live headlines.

4. [`2026-07-27-g2-keyless-osm-map.md`](./2026-07-27-g2-keyless-osm-map.md)
   Fetch bounded OpenStreetMap road geometry through Overpass and render it
   into the fixed left Canvas without changing its size.

5. [`2026-07-27-g2-optional-ors-routing.md`](./2026-07-27-g2-optional-ors-routing.md)
   Add server-only ORS geocoding/directions, destination controls, route
   guidance, active-navigation location updates, and the key-missing state.

## Cross-plan invariants

- Never install SDK `0.0.12` or add its LZ4 transport flag.
- Never send two G2 image updates concurrently.
- Page scroll redraws and sends only IDs `3` and `5`.
- User-forward scroll keeps page order `1→2→3→4`. The tile-send order does not
  require SDK event-direction inversion.
- Map-only refresh redraws and sends only IDs `2` and `4`.
- Weather/news-only refresh redraws and sends only IDs `3` and `5`.
- A simultaneous left/right refresh coalesces to IDs `3`, `5`, `2`, and `4`.
- While hidden, live state may update but no image is sent; restore sends the
  newest state to all four containers in `3/5/2/4` order.
- `ORS_API_KEY` appears only in server environment access and tests with a fake
  value. It never enters `VITE_*`, `app.json`, client code, logs, or commits.
- Every provider keeps the last successful cache on a refresh failure.
- All public data use remains personal and non-commercial until licensing and
  infrastructure are reviewed again.

## Completion gate

After all five plans:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
git grep -n "ORS_API_KEY" -- ':!docs/**' ':!tests/**' ':!server/*.test.*'
```

Expected:

- all Vitest and Node tests pass;
- TypeScript and production build exit `0`;
- Sites artifacts exist;
- the secret-name search finds server environment access only;
- the physical G2 shows live keyless data and retains fast two-tile paging;
- with no ORS key, navigation alone says routing is disabled;
- with an ORS key, a selected destination produces a route and maneuver.

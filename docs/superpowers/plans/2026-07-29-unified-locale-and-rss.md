# Unified Locale and RSS Defaults Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply one phone language setting to the shipped phone companion, live fast HUD, weather copy, and OSM labels. Provide three verified built-in RSS feeds per supported language.

**Architecture:** Resolve locale at render time so cached domain data remains language-neutral. Keep multilingual OSM names in one map payload. Keep built-in RSS metadata separate from six custom slots. Expose one best-effort HUD redraw callback through the existing busy-drop transport.

**Tech Stack:** React 19, TypeScript, Canvas 2D, Even Hub SDK 0.0.11, Cloudflare-style Worker handlers, Vitest, Testing Library, Node test runner

---

### Task 1: Shared fixed-copy localization and breadcrumb hierarchy

**Files:**
- Create: `src/hud-i18n.ts`
- Modify: `src/weather.ts`
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `src/phone/WeatherScreen.tsx`
- Modify: `src/phone/phone-shell.css`
- Modify: `src/App.tsx`
- Test: `src/weather.test.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing weather and phone tests**

Add assertions that:

```ts
expect(weatherCodeLabel(2, "ko"))
  .toBe("\uB300\uCCB4\uB85C \uB9D1\uC74C");
expect(weatherCodeLabel(2, "en")).toBe("Mostly clear");
```

Render the companion with English preferences and assert the visible weather
condition and controller status contain no Korean fixed copy. Assert the
breadcrumb parent and current title use the same computed font size.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
npx vitest run src/weather.test.ts src/App.test.tsx
```

Expected: FAIL because `weatherCodeLabel` has no locale argument, status is
initialized in Korean, and the breadcrumb parent is `0.72rem`.

- [ ] **Step 3: Add small locale helpers and localize phone display**

Create:

```ts
export type HudStringKey =
  | "weatherFeelsLike"
  | "weatherHumidity"
  | "weatherPrecipitation"
  | "weatherWind"
  | "noData"
  | "noGpsData";

export function translateHud(locale: PhoneLocale, key: HudStringKey): string {
  return HUD_STRINGS[locale][key];
}
```

Change `weatherCodeLabel(code, locale = "ko")` to select Korean or English
labels. Keep `parseWeatherResponse` storing the Korean compatibility value, but
render phone weather from `weather.weatherCode` and the effective locale.
Replace `App`'s initial Korean transport status with a language-neutral status
code or localized display label.

- [ ] **Step 4: Strengthen the breadcrumb**

Make parent and current segments both `1rem`, parent medium/muted, separator
muted, and current title semibold. Preserve the text-only internal navigation
with no second arrow.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run src/weather.test.ts src/App.test.tsx
```

Expected: PASS.

### Task 2: Localize live fast HUD without changing transport

**Files:**
- Modify: `src/hud-i18n.ts`
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-detail-hud.ts`
- Modify: `src/fast-news-pages.ts`
- Modify: `src/fast-map.ts`
- Modify: `src/fast-hud-controller.ts`
- Modify: `src/hud-controller-types.ts`
- Modify: `src/App.tsx`
- Test: `src/fast-canvas-hud.test.ts`
- Test: `src/fast-detail-hud.test.ts`
- Test: `src/fast-news-pages.test.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing English HUD tests**

Call the draw functions with locale `"en"`. Assert that recorded Canvas text contains `FEELS`, `HUMIDITY`, `WEATHER`, `COMPLETED`, and English empty-state copy. Assert that fixed Korean strings are absent.

- [ ] **Step 2: Run the focused HUD tests and verify failure**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts src/fast-detail-hud.test.ts src/fast-news-pages.test.ts
```

Expected: FAIL because draw functions use fixed Korean copy.

- [ ] **Step 3: Thread locale through every shipped fast draw**

Use optional defaulted signatures so existing Korean tests stay stable:

```ts
drawFastCanvasHud(canvas, now, page, data, locale = "ko");
drawFastDetailHud(canvas, options, locale = "ko");
drawFastFullscreenMap(canvas, live, radius, locale = "ko");
paginateFastNewsSummary(context, summary, locale = "ko");
```

Move weekdays, weather metric labels, loading/empty copy, TODO progress copy,
navigation copy, and summary fallback into `hud-i18n.ts`. Do not translate RSS
titles/summaries, TODO titles, or route destination values.

- [ ] **Step 4: Add one best-effort locale redraw**

Add a mutable callback ref to `UseHudControllerOptions`:

```ts
readonly displayRefreshRef: MutableRefObject<(() => void) | undefined>;
```

The controller resolves locale from `phonePreferencesRef.current` immediately
before drawing and exposes:

```ts
displayRefreshRef.current = () => {
  drawCurrentPage();
  requestVisibleRefresh("all");
};
```

Clear the callback on cleanup. `requestVisibleRefresh` retains the current
busy-drop behavior, so no request is queued.

- [ ] **Step 5: Invoke redraw after a saved locale change**

In `App`, compare the previous and next effective locale after preferences are
saved. Update the preferences ref first, then call the redraw callback once when
the locale changed.

- [ ] **Step 6: Run focused HUD and integration tests**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts src/fast-detail-hud.test.ts src/fast-news-pages.test.ts src/App.test.tsx
```

Expected: PASS with unchanged tile-order assertions.

### Task 3: Preserve and select multilingual OSM names

**Files:**
- Modify: `src/live-state.ts`
- Modify: `server/map.js`
- Modify: `src/map.ts`
- Modify: `src/fast-map.ts`
- Modify: `src/phone/WeatherScreen.tsx`
- Test: `tests/map-api.test.mjs`
- Test: `src/map.test.ts`
- Test: `src/fast-map.test.ts`

- [ ] **Step 1: Write failing map payload and selection tests**

Use an OSM element with:

```js
tags: {
  name: "Daeche-ro",
  "name:ko": "\uB300\uCCB4\uB85C",
  "name:en": "Daeche-ro",
}
```

Assert the Worker returns both localized names and:

```ts
expect(mapLabelName(label, "ko")).toBe("\uB300\uCCB4\uB85C");
expect(mapLabelName(label, "en")).toBe("Daeche-ro");
```

- [ ] **Step 2: Run focused map tests and verify failure**

Run:

```bash
npx vitest run src/map.test.ts src/fast-map.test.ts
node --test tests/map-api.test.mjs
```

Expected: FAIL because the server discards `name:en`.

- [ ] **Step 3: Add bounded multilingual names**

Extend `MapLabel` with:

```ts
readonly localizedNames?: Partial<Record<PhoneLocale, string>>;
```

Normalize `name`, `name:ko`, and `name:en` independently on the Worker, preserve
valid localized names in client validation/cloning, and select with:

```ts
return label.localizedNames?.[locale] ?? label.name;
```

- [ ] **Step 4: Bust old Korean-only caches**

Change Worker cache request from `roads-labels-v3` to `roads-labels-v4` and the
client cache key from `map-labels` to `map-labels-i18n`.

- [ ] **Step 5: Use locale in map and nearby-location rendering**

Pass the effective locale to `drawFastMap`, `drawFastFullscreenMap`, and the
phone weather screen. OSM default names remain the fallback when a localized
tag is missing.

- [ ] **Step 6: Run all map tests**

Run:

```bash
npx vitest run src/map.test.ts src/fast-map.test.ts src/fast-canvas-hud.test.ts
node --test tests/map-api.test.mjs
```

Expected: PASS.

### Task 4: Add three built-in RSS feeds per locale

**Files:**
- Modify: `src/rss-sources.ts`
- Modify: `src/news.ts`
- Modify: `server/news.js`
- Modify: `src/phone/NewsScreen.tsx`
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `src/phone-i18n.ts`
- Modify: `src/App.tsx`
- Test: `src/rss-sources.test.ts`
- Test: `src/news.test.ts`
- Test: `src/live-dashboard.test.ts`
- Test: `tests/news-api.test.mjs`

- [ ] **Step 1: Write failing bundle and migration tests**

Assert:

```ts
expect(defaultRssSources("ko")).toHaveLength(3);
expect(defaultRssSources("en")).toHaveLength(3);
expect(resolveRssSources(storage, "en")).resolves.toEqual(
  expect.arrayContaining([
    expect.objectContaining({ id: "bbc-world", locale: "en" }),
  ]),
);
```

Add a legacy SBS record plus one custom source and assert migration preserves
the custom source. Assert adding six custom sources succeeds even with three
built-ins, and the seventh fails.

- [ ] **Step 2: Run focused RSS tests and verify failure**

Run:

```bash
npx vitest run src/rss-sources.test.ts src/news.test.ts src/live-dashboard.test.ts
node --test tests/news-api.test.mjs
```

Expected: FAIL because only one default exists and all sources share one
six-item limit.

- [ ] **Step 3: Define stable built-in metadata**

Extend `RssSource` with optional locale and built-in feed alias. Define Korean
IDs `sbs-latest`, `newsis-breaking`, `weekly-khan` and English IDs `bbc-world`,
`guardian-world`, `lemonde-international`. Count only `isDefault === false`
records against `CUSTOM_SOURCE_LIMIT = 6`.

- [ ] **Step 4: Migrate storage without losing user data**

Make `resolveRssSources(storage, locale)` normalize legacy source arrays, merge
the locale's three built-ins, retain custom records, and retain matching
built-in enabled/name overrides. `writeRssSources` validates three locale
built-ins plus at most six custom sources.

- [ ] **Step 5: Add fixed Worker aliases**

Add all verified feed URLs to `server/news.js`'s `FEEDS` map. In `resolveNews`,
use `/api/news?feed=${source.feed}` for built-ins and the custom URL proxy only
for user feeds.

- [ ] **Step 6: Make the phone source screen locale-aware**

Pass locale to `NewsScreen`. Group or label built-in and custom sources without a new management route. Update source-limit copy to say "six custom RSS sources." On locale change, resolve the active bundle. Request the existing guarded refill. Do not refill if the news reader is active.

- [ ] **Step 7: Run focused RSS tests**

Run:

```bash
npx vitest run src/rss-sources.test.ts src/news.test.ts src/live-dashboard.test.ts src/App.test.tsx
node --test tests/news-api.test.mjs
```

Expected: PASS.

### Task 5: Durable direction, serial regression, and delivery

**Files:**
- Modify: `AGENTS.md`
- Verify: all changed files

- [ ] **Step 1: Record the new durable product direction**

Replace the old phone-only localization constraint with the approved rule. The phone locale controls the shipped phone UI, `/hud-canvas-fast`, weather fixed copy, and multilingual map labels. Keep legacy diagnostics unchanged.
Record the three-per-language built-in RSS bundle and six custom slots.

- [ ] **Step 2: Run formatting and type checks serially**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0.

- [ ] **Step 3: Run the complete test suite serially**

Run:

```bash
npm test -- --run
npm run test:repo
npm run test:sites
```

Expected: all test files pass with no overlapping test processes.

- [ ] **Step 4: Build and inspect the working tree**

Run:

```bash
npm run build
git diff --check
git status --short
```

Expected: build succeeds, no whitespace errors, and only intended files are
listed.

- [ ] **Step 5: Verify the Tailscale preview**

Keep the existing Vite preview on port 4176 and check:

```bash
curl -I "http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11"
```

Expected: HTTP 200.

- [ ] **Step 6: Commit and push**

Run:

```bash
git add AGENTS.md src server tests docs/superpowers/plans/2026-07-29-unified-locale-and-rss.md
git commit -m "feat: unify locale across phone hud map and news"
git push origin main
```

Expected: `origin/main` advances to the verified commit.

# Extensible I18n Registry Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require one complete locale pack, one registry entry, and three shared RSS feed definitions for each new Sandevistan language. Preserve current Korean, English, map, and G2 transport behavior.

**Architecture:** Use the English locale pack as a compile-time structural schema. Derive supported locale types and runtime options from one registry. Keep existing phone/HUD translation functions as compatibility adapters. Make map language tags generic and move browser/server built-in RSS metadata into one shared server catalog.

**Tech Stack:** TypeScript 5.9, React 19, Vite 6, Vitest, Testing Library, Node test runner, Cloudflare-style Worker modules, Even Hub SDK 0.0.11

---

### Task 1: Define the locale-pack contract and registry

**Files:**
- Create: `src/i18n/locales/en.ts`
- Create: `src/i18n/locales/ko.ts`
- Create: `src/i18n/locale-schema.ts`
- Create: `src/i18n/locale-registry.ts`
- Create: `src/i18n/locale-registry.test.ts`
- Modify: `src/phone-types.ts`

- [ ] **Step 1: Write the failing registry test**

Create tests that import the wished-for registry API and assert:

```ts
expect(SUPPORTED_LOCALES).toEqual(["ko", "en"]);
expect(LOCALE_OPTIONS).toEqual([
  { value: "ko", label: "\uD55C\uAD6D\uC5B4" },
  { value: "en", label: "English" },
]);
expect(resolveLocale("system", "ko-KR")).toBe("ko");
expect(resolveLocale("system", "en_US")).toBe("en");
expect(resolveLocale("system", "ja-JP")).toBe("en");
expect(resolveLocale("ko", "en-US")).toBe("ko");
```

Iterate the registry. Assert that every key equals `pack.code` and each pack has seven weekdays. Every recursive message path in English must exist in the other packs.

- [ ] **Step 2: Run the registry test and verify RED**

Run:

```bash
npx vitest run src/i18n/locale-registry.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the registry modules do not exist.

- [ ] **Step 3: Add English and Korean locale packs**

Move the existing values, unchanged, into packs shaped as:

```ts
export const enLocale = {
  code: "en",
  nativeName: "English",
  browserTags: ["en"],
  phone: { /* existing phone strings */ },
  hud: { /* existing fast-HUD strings */ },
  route: {
    /* existing route-control strings */,
    profiles: {
      "foot-walking": "Walking",
      "cycling-regular": "Cycling",
      "driving-car": "Driving",
    },
  },
  weather: { /* semantic WMO condition strings */ },
  todos: { station: "...", umbrella: "...", route: "..." },
  weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday"],
} as const;
```

Define a recursive `LocalizedShape<typeof enLocale>` schema that preserves
keys and tuple length while widening translated values to strings. Make the
Korean pack `satisfies LocalePack`.

- [ ] **Step 4: Implement the registry-derived API**

Export:

```ts
export const LOCALE_REGISTRY = { en: enLocale, ko: koLocale } as const;
export type SupportedLocale = keyof typeof LOCALE_REGISTRY;
export type LocaleSetting = "system" | SupportedLocale;
export const SUPPORTED_LOCALES = Object.freeze(
  Object.keys(LOCALE_REGISTRY) as SupportedLocale[],
);
export const LOCALE_OPTIONS = SUPPORTED_LOCALES.map((value) => ({
  value,
  label: LOCALE_REGISTRY[value].nativeName,
}));
export function isSupportedLocale(value: unknown): value is SupportedLocale;
export function resolveLocale(
  setting: LocaleSetting,
  browserLanguage: string,
): SupportedLocale;
```

Normalize `_` to `-`, compare configured browser tags case-insensitively, then
compare base languages and fall back to English. Alias the existing
`PhoneLocale` and `PhoneLocaleSetting` types to these registry-derived types.

- [ ] **Step 5: Run the focused test and typecheck**

Run:

```bash
npx vitest run src/i18n/locale-registry.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: the registry test and TypeScript both pass because the compatibility
aliases still resolve to the existing `"en" | "ko"` union.

- [ ] **Step 6: Commit the registry foundation**

Commit:

```bash
git add src/i18n src/phone-types.ts
git commit -m "refactor: add typed locale registry"
```

### Task 2: Generate phone and domain localization from the registry

**Files:**
- Modify: `src/phone-i18n.ts`
- Modify: `src/hud-i18n.ts`
- Modify: `src/phone-preferences.ts`
- Modify: `src/phone/LanguageScreen.tsx`
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `src/weather.ts`
- Modify: `src/todos.ts`
- Modify: `src/RouteControls.tsx`
- Modify: `src/phone-i18n.test.ts`
- Modify: `src/phone-preferences.test.ts`
- Modify: `src/phone/LanguageScreen.test.tsx`
- Modify: `src/weather.test.ts`
- Modify: `src/todos.test.ts`
- Modify: `src/RouteControls.test.tsx`

- [ ] **Step 1: Write failing adapter and generated-choice tests**

Add tests that assert:

```ts
expect(PHONE_STRINGS.en).toBe(LOCALE_REGISTRY.en.phone);
expect(translateHud("ko", "weatherLoading"))
  .toBe("\uB0A0\uC528 \uBD88\uB7EC\uC624\uB294 \uC911");
expect(weatherCodeLabel(2, "en")).toBe("Mostly clear");
expect(defaultTodos("ko")[0].title)
  .toBe("\uC9C0\uD558\uCCA0\uC5ED\uC73C\uB85C \uC774\uB3D9");
```

Render `LanguageScreen` and assert its radio choices equal `System` plus every
entry in `LOCALE_OPTIONS`, without a hardcoded `ko`/`en` choice array. Add a
preference test proving an unsupported persisted locale normalizes to
`system`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/phone-i18n.test.ts src/phone-preferences.test.ts src/phone/LanguageScreen.test.tsx src/weather.test.ts src/todos.test.ts src/RouteControls.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because domain dictionaries and language choices still live in
their consumers.

- [ ] **Step 3: Turn existing i18n modules into adapters**

Make `PHONE_STRINGS` and HUD translation functions read from
`LOCALE_REGISTRY`. Derive `PhoneStringKey` and `HudStringKey` from the English
pack. Replace handwritten weekdays with `pack.weekdays`.

- [ ] **Step 4: Generate locale validation and language choices**

Use `isSupportedLocale` in persisted preference validation. In
`LanguageScreen`, render:

```ts
const choices = [
  { value: "system" as const, label: t("system") },
  ...LOCALE_OPTIONS,
];
```

Use registry metadata for the Home language status instead of a Korean/English
ternary.

- [ ] **Step 5: Migrate weather, TODO, and route copy**

Map each WMO code range to a semantic condition key and return
`LOCALE_REGISTRY[locale].weather[key]`. Read default TODO titles from
`pack.todos`. Replace `ROUTE_COPY` with `LOCALE_REGISTRY[locale].route`.
Preserve the existing technical `ROUTE // ...` tokens and all user data.

- [ ] **Step 6: Run focused tests and full typecheck**

Run:

```bash
npx vitest run src/phone-i18n.test.ts src/phone-preferences.test.ts src/phone/LanguageScreen.test.tsx src/weather.test.ts src/todos.test.ts src/RouteControls.test.tsx --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: all focused tests and TypeScript pass.

- [ ] **Step 7: Commit the consumer migration**

Commit:

```bash
git add src
git commit -m "refactor: derive localized domains from registry"
```

### Task 3: Share one built-in RSS catalog across browser and server

**Files:**
- Create: `server/news-feeds.js`
- Create: `server/news-feeds.d.ts`
- Modify: `server/news.js`
- Modify: `src/rss-sources.ts`
- Modify: `scripts/prepare-sites-build.mjs`
- Modify: `src/rss-sources.test.ts`
- Modify: `tests/news-api.test.mjs`
- Modify: `tests/sites-worker.test.mjs`

- [ ] **Step 1: Write failing shared-catalog tests**

Import `BUILT_IN_RSS_FEEDS` in both test suites. Assert unique IDs and URLs,
public HTTPS URLs, supported locales, and:

```ts
for (const locale of SUPPORTED_LOCALES) {
  expect(BUILT_IN_RSS_FEEDS.filter((feed) => feed.locale === locale))
    .toHaveLength(3);
}
```

Assert every fixed server alias resolves to the exact URL in that shared
catalog. Require `dist/server/news-feeds.js` in the Sites artifact test.

- [ ] **Step 2: Run RSS and Sites tests and verify RED**

Run:

```bash
npx vitest run src/rss-sources.test.ts --no-file-parallelism --maxWorkers=1
node --test --test-concurrency=1 tests/news-api.test.mjs
npm run build
npm run test:sites
```

Expected: FAIL because `server/news-feeds.js` and its packaged copy do not
exist.

- [ ] **Step 3: Create the shared feed catalog**

Export one frozen array containing the current six definitions:

```js
export const BUILT_IN_RSS_FEEDS = Object.freeze([
  {
    id: "sbs-latest",
    name: "SBS \uCD5C\uC2E0\uB274\uC2A4",
    url: "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER",
    locale: "ko",
  },
  // five existing definitions
]);
```

Add a declaration file with readonly `id`, `name`, `url`, and `locale` strings.

- [ ] **Step 4: Derive client and server behavior from the catalog**

In `src/rss-sources.ts`, map definitions to immutable built-in `RssSource`
records and validate locale values with `isSupportedLocale`. In
`server/news.js`, build `FEEDS` from the same array. Remove both duplicate feed
lists while preserving aliases, caching, URL safety, and custom-feed behavior.

- [ ] **Step 5: Package the catalog**

Add `news-feeds.js` to `serverFiles` in `prepare-sites-build.mjs` and to the
Sites artifact assertions.

- [ ] **Step 6: Run focused RSS, API, build, and Sites tests**

Run:

```bash
npx vitest run src/rss-sources.test.ts src/news.test.ts --no-file-parallelism --maxWorkers=1
node --test --test-concurrency=1 tests/news-api.test.mjs
npm run build
npm run test:sites
```

Expected: all commands pass.

- [ ] **Step 7: Commit the RSS catalog**

Commit:

```bash
git add server src/rss-sources.ts src/rss-sources.test.ts tests/news-api.test.mjs scripts/prepare-sites-build.mjs tests/sites-worker.test.mjs
git commit -m "refactor: share locale rss catalog"
```

### Task 4: Make OSM localized names language-agnostic

**Files:**
- Modify: `src/live-state.ts`
- Modify: `src/map.ts`
- Modify: `server/map.js`
- Modify: `src/map.test.ts`
- Modify: `tests/map-api.test.mjs`

- [ ] **Step 1: Write failing generic OSM-language tests**

Add an OSM element containing:

```js
{
  name: "東京駅",
  "name:en": "Tokyo Station",
  "name:ja": "東京駅",
}
```

Assert the server returns both `en` and `ja`, the client parser preserves them,
and the default name remains available. Add invalid-tag, control-character,
per-label count-limit, and overlong-value cases.

- [ ] **Step 2: Run map tests and verify RED**

Run:

```bash
npx vitest run src/map.test.ts --no-file-parallelism --maxWorkers=1
node --test --test-concurrency=1 tests/map-api.test.mjs
```

Expected: FAIL because server and client currently accept only `ko` and `en`.

- [ ] **Step 3: Generalize bounded localized-name records**

Change `MapLabel.localizedNames` to `Readonly<Record<string, string>>`. Define
one language-tag validator that accepts normalized OSM language keys and cap
each label to eight localized names. The server walks `name:*` tags, sanitizes
each value, sorts keys for deterministic output, and retains only bounded
entries.

- [ ] **Step 4: Version map caches**

Advance the client cache key from `map-labels-i18n` to
`map-labels-i18n-v2` and the Worker cache URL from `roads-labels-v4` to
`roads-labels-v5`.

- [ ] **Step 5: Run all map tests**

Run:

```bash
npx vitest run src/map.test.ts src/fast-map.test.ts src/live-dashboard-map.test.ts --no-file-parallelism --maxWorkers=1
node --test --test-concurrency=1 tests/map-api.test.mjs
```

Expected: all tests pass with unchanged Korean and English selection.

- [ ] **Step 6: Commit generic map localization**

Commit:

```bash
git add src/live-state.ts src/map.ts server/map.js src/map.test.ts tests/map-api.test.mjs
git commit -m "refactor: generalize osm locale labels"
```

### Task 5: Document the extension contract and run serial verification

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/i18n/adding-a-language.md`
- Modify: `docs/hardware/2026-07-29-phone-companion-completion-audit.md`

- [ ] **Step 1: Record the durable language-extension contract**

Document the exact three-edit workflow, required locale-pack fields, RSS
security constraints, OSM fallback behavior, and serial test commands. State
that locale changes must never alter the proven G2 transport contract.

- [ ] **Step 2: Update the completion audit**

Record the registry, shared RSS catalog, generic OSM tags, migration behavior,
and final verification counts. Keep release, Even Hub, and SDK `0.0.12`
deferrals unchanged.

- [ ] **Step 3: Run repository and source checks**

Run serially:

```bash
git diff --check
npm run test:repo
npm run typecheck
```

Expected: all pass.

- [ ] **Step 4: Run the complete Vitest suite**

Run:

```bash
npm test
```

Expected: all source tests pass with one worker and no file parallelism.

- [ ] **Step 5: Run Node API and Sites tests**

Run:

```bash
node --test --test-concurrency=1 tests/*.test.mjs
npm run build
npm run test:sites
```

Expected: all Node tests, production build, and Sites artifact tests pass.

- [ ] **Step 6: Package and inspect the Even artifact**

Run:

```bash
npm run pack
shasum -a 256 sandevistan.ehpk
```

Expected: `sandevistan.ehpk` is produced and a SHA-256 is recorded in the
completion audit.

- [ ] **Step 7: Commit documentation and push**

Commit:

```bash
git add AGENTS.md docs
git commit -m "docs: document locale extension workflow"
git push origin main
```

Verify the worktree is clean, `HEAD` equals `origin/main`, and the existing
Tailscale preview returns HTTP 200.

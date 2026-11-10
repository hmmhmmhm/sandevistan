# Adding a Sandevistan Language

Sandevistan keeps application-owned localization in a typed locale registry.
The phone companion and shipped G2 HUD derive from that registry.
The registry also controls route copy, weather labels, default TODO titles, weekdays, OSM label selection, preferences and language choices.

User-authored TODO text, RSS article content, destination names, route
instructions, and the OSM default name are never translated.

## Required changes

Assume the new locale is Japanese with code `ja`.

### 1. Add one complete locale pack

Copy `src/i18n/locales/en.ts` to `src/i18n/locales/ja.ts`, translate every
string value, and preserve all keys:

```ts
import type { LocalePack } from "../locale-schema";

export const jaLocale = {
  code: "ja",
  nativeName: "日本語",
  browserTags: ["ja", "ja-JP"],
  direction: "ltr",
  phone: {
    // Every phone key from the English reference pack.
  },
  hud: {
    // Every shipped fast-HUD key.
  },
  route: {
    // Route controls and all three profile labels.
  },
  weather: {
    // All semantic WMO condition labels.
  },
  todos: {
    station: "駅へ移動",
    umbrella: "傘を持つ",
    route: "経路を確認",
  },
  weekdays: [
    "日曜日",
    "月曜日",
    "火曜日",
    "水曜日",
    "木曜日",
    "金曜日",
    "土曜日",
  ],
} as const satisfies LocalePack;
```

`LocalePack` is derived from the English reference pack. TypeScript rejects a
missing, misspelled, extra, or structurally incompatible translation key.
Use `direction: "rtl"` only when the phone language reads right to left.
The phone root derives its `lang` and `dir` attributes from this metadata; the
nested tactical HUD remains LTR so its fixed tile geometry never mirrors.

### 2. Register the pack once

Import the pack and add one entry to `src/i18n/locale-registry.ts`:

```ts
import { jaLocale } from "./locales/ja";

export const LOCALE_REGISTRY = {
  ko: koLocale,
  en: enLocale,
  ja: jaLocale,
} as const;
```

The `SupportedLocale` type, language choices, native label, persisted-value
validation, system-language matching, domain adapters, and map selection now
include Japanese automatically.

Keep registry entries in code order so the language screen remains
deterministic.

### 3. Add exactly three built-in RSS feeds

Add three unique public HTTPS entries to `server/news-feeds.js`:

```js
{
  id: "example-japan-latest",
  name: "Example Japan",
  url: "https://news.example.jp/latest.xml",
  locale: "ja",
},
```

The browser source manager and same-origin server allowlist import this same
catalog. Do not duplicate the feed in a client TypeScript file.

Built-in feed IDs must be unique.
A locale can reuse a feed URL through the declared English fallback.
Feeds must return bounded RSS or Atom XML without an upstream redirect. Custom sources remain separate and do not
count toward the three built-ins.

The earlier baseline contained thirty registered languages and ninety built-in feeds.
The current catalog contains 180 locales and 540 built-in feed entries.
For Google News, store final canonical topic URLs rather than short topic paths
that return a redirect.

## No other language branches

Do not add:

- a handwritten locale union;
- an option in `LanguageScreen`;
- a condition such as `locale === "ja"`;
- a route-copy object in `RouteControls`;
- a weather-label branch;
- a default TODO table;
- a `name:ja` branch in the map Worker; or
- a duplicate RSS URL in `server/news.js` or `src/rss-sources.ts`.

The generic map payload already preserves valid bounded OSM
`name:<language>` values and falls back to the OSM default name.

## Required verification

Run every command serially:

```bash
npx vitest run src/i18n/locale-registry.test.ts --no-file-parallelism --maxWorkers=1
npx vitest run src/rss-sources.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
npm test
node --test --test-concurrency=1 tests/*.test.mjs
npm run verify:rss-live
npm run build
npm run test:sites
npm run pack
```

Add language-specific assertions for representative phone, HUD, weather, TODO,
and route strings. Registry tests verify pack structure, seven weekdays,
code/key consistency, native options, and fallback. RSS tests fail unless the
new locale has exactly three built-in feeds. The live verifier checks every feed serially with an eight-second timeout.
It rejects redirects, non-200 responses, non-XML content and bodies over 1 MB.
It also rejects missing RSS/Atom roots and empty feeds.

The new locale must not change four-tile encoding, the `3/5/2/4` initial
transfer order, `3/5` page transfers, binocular output, busy-drop refresh, or
black-frame hide and restore.

The current root quick menu provides separate Hide, Exit and Return actions.
See the [product guide](../product/overview.md) before changing those gestures.

# Thirty-Language Catalog Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task. Run every test serially.

**Goal:** Ship thirty structurally complete Sandevistan languages and exactly
three live, validated built-in news channels for every language without
changing G2 transport behavior.

**Architecture:** Keep one typed locale pack per language and register each
pack once. Extend locale metadata with text direction, derive phone behavior
from the registry, and keep the tactical Canvas geometry LTR. Build all
built-in news sources from one server catalog, then verify its ninety final
URLs with an explicit serial live-audit command.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Node.js 22 test runner,
Vite 6, Even Hub SDK 0.0.11, RSS/Atom over HTTPS.

---

### Task 1: Lock the thirty-language registry contract

**Files:**
- Modify: `src/i18n/locale-schema.ts`
- Modify: `src/i18n/locale-registry.test.ts`
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/ko.ts`

- [ ] **Step 1: Write the failing registry-size and metadata test**

Add the approved code order and require every pack to expose direction:

```ts
const EXPECTED_LOCALES = [
  "ko", "en", "ja", "zh-Hans", "zh-Hant", "es", "fr", "de", "it", "pt",
  "nl", "pl", "ru", "uk", "tr", "ar", "he", "hi", "bn", "id", "vi", "th",
  "ms", "fil", "sv", "no", "da", "fi", "cs", "ro",
] as const;

expect(SUPPORTED_LOCALES).toEqual(EXPECTED_LOCALES);
expect(new Set(SUPPORTED_LOCALES)).toHaveLength(30);
for (const locale of SUPPORTED_LOCALES) {
  expect(["ltr", "rtl"]).toContain(LOCALE_REGISTRY[locale].direction);
}
```

Add alias expectations:

```ts
expect(resolveLocale("system", "zh_TW")).toBe("zh-Hant");
expect(resolveLocale("system", "zh-CN")).toBe("zh-Hans");
expect(resolveLocale("system", "pt_BR")).toBe("pt");
expect(resolveLocale("system", "iw-IL")).toBe("he");
expect(resolveLocale("system", "in-ID")).toBe("id");
expect(resolveLocale("system", "tl-PH")).toBe("fil");
expect(resolveLocale("system", "nb-NO")).toBe("no");
```

- [ ] **Step 2: Run the registry test and verify RED**

Run:

```bash
npx vitest run src/i18n/locale-registry.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: fail because only `ko` and `en` exist and direction is missing.

- [ ] **Step 3: Add the direction schema**

Add `direction: "ltr"` to English and Korean, then change `LocalePack`:

```ts
export type LocalePack = Omit<
  TranslatedEnglishPack,
  "code" | "nativeName" | "browserTags" | "direction"
> & {
  readonly code: string;
  readonly nativeName: string;
  readonly browserTags: readonly string[];
  readonly direction: "ltr" | "rtl";
};
```

- [ ] **Step 4: Run the registry test and confirm only missing locales fail**

- [ ] **Step 5: Commit the contract**

```bash
git add src/i18n
git commit -m "test: define thirty-language registry contract"
```

### Task 2: Add CJK and major European locale packs

**Files:**
- Create: `src/i18n/locales/ja.ts`
- Create: `src/i18n/locales/zh-Hans.ts`
- Create: `src/i18n/locales/zh-Hant.ts`
- Create: `src/i18n/locales/es.ts`
- Create: `src/i18n/locales/fr.ts`
- Create: `src/i18n/locales/de.ts`
- Create: `src/i18n/locales/it.ts`
- Create: `src/i18n/locales/pt.ts`
- Create: `src/i18n/locales/nl.ts`
- Modify: `src/i18n/locale-registry.ts`

- [ ] **Step 1: Add nine complete packs**

Each file must preserve every English pack key and end with:

```ts
} as const satisfies LocalePack;
```

Use the exact metadata aliases from the approved design. Translate phone, HUD,
route, weather, default task, and weekday copy; retain technical proper nouns.
Keep every file under 450 lines.

- [ ] **Step 2: Register the nine packs after English**

Import the modules and append keys in this order:

```ts
ja, "zh-Hans", "zh-Hant", es, fr, de, it, pt, nl
```

- [ ] **Step 3: Run typecheck and the registry test**

Expected: TypeScript proves full pack shape. The registry test still fails with
nineteen locales missing.

- [ ] **Step 4: Commit**

```bash
git add src/i18n
git commit -m "feat: add CJK and major European locales"
```

### Task 3: Add the remaining European locale packs

**Files:**
- Create: `src/i18n/locales/pl.ts`
- Create: `src/i18n/locales/ru.ts`
- Create: `src/i18n/locales/uk.ts`
- Create: `src/i18n/locales/tr.ts`
- Create: `src/i18n/locales/sv.ts`
- Create: `src/i18n/locales/no.ts`
- Create: `src/i18n/locales/da.ts`
- Create: `src/i18n/locales/fi.ts`
- Create: `src/i18n/locales/cs.ts`
- Create: `src/i18n/locales/ro.ts`
- Modify: `src/i18n/locale-registry.ts`

- [ ] **Step 1: Add ten complete packs**

Use native labels, full browser aliases, and LTR direction from the design.
Norwegian must include `no`, `nb`, and `nn` aliases in one pack.

- [ ] **Step 2: Register them in approved order**

Insert `pl`, `ru`, `uk`, and `tr` before Arabic. Insert `sv`, `no`, `da`,
`fi`, `cs`, and `ro` after Filipino.

- [ ] **Step 3: Run typecheck and registry tests**

Expected: nine locales remain missing.

- [ ] **Step 4: Commit**

```bash
git add src/i18n
git commit -m "feat: add European locale catalog"
```

### Task 4: Add RTL, Indic, and Southeast Asian locale packs

**Files:**
- Create: `src/i18n/locales/ar.ts`
- Create: `src/i18n/locales/he.ts`
- Create: `src/i18n/locales/hi.ts`
- Create: `src/i18n/locales/bn.ts`
- Create: `src/i18n/locales/id.ts`
- Create: `src/i18n/locales/vi.ts`
- Create: `src/i18n/locales/th.ts`
- Create: `src/i18n/locales/ms.ts`
- Create: `src/i18n/locales/fil.ts`
- Modify: `src/i18n/locale-registry.ts`

- [ ] **Step 1: Add nine complete packs**

Arabic and Hebrew use `direction: "rtl"`. Indonesian includes legacy `in`
aliases, Hebrew includes legacy `iw` aliases, and Filipino includes `tl`
aliases. The other seven packs use LTR.

- [ ] **Step 2: Register all nine in approved order**

- [ ] **Step 3: Run typecheck and registry tests**

Expected: thirty locales and every alias assertion pass.

- [ ] **Step 4: Run representative domain tests**

```bash
npx vitest run \
  src/phone-i18n.test.ts \
  src/hud-i18n.test.ts \
  src/weather.test.ts \
  src/todos.test.ts \
  src/RouteControls.test.tsx \
  --no-file-parallelism --maxWorkers=1
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "feat: complete thirty-language locale registry"
```

### Task 5: Apply locale direction to the phone companion

**Files:**
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `src/phone/PhoneCompanion.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing direction tests**

Render Arabic and English preferences and assert:

```ts
expect(screen.getByTestId("phone-companion").getAttribute("dir")).toBe("rtl");
expect(screen.getByTestId("phone-companion").getAttribute("lang")).toBe("ar");
```

English must produce `dir="ltr"` and `lang="en"`. The nested HUD frame keeps
`dir="ltr"`.

- [ ] **Step 2: Run focused tests and verify RED**

- [ ] **Step 3: Add registry-derived attributes**

Set `data-testid`, `lang`, and `dir` on the phone companion root from
`LOCALE_REGISTRY[locale]`. Set `dir="ltr"` on the tactical HUD frame and Canvas.

- [ ] **Step 4: Run focused tests and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/phone
git commit -m "feat: support RTL phone locales"
```

### Task 6: Expand the shared RSS catalog to ninety feeds

**Files:**
- Modify: `server/news-feeds.js`
- Modify: `src/rss-sources.test.ts`
- Modify: `tests/news-api.test.mjs`

- [ ] **Step 1: Strengthen the failing structural test**

Add:

```ts
expect(BUILT_IN_RSS_FEEDS).toHaveLength(90);
for (const locale of SUPPORTED_LOCALES) {
  expect(BUILT_IN_RSS_FEEDS.filter((feed) => feed.locale === locale))
    .toHaveLength(3);
}
```

Iterate every locale in the source-seeding test instead of checking only
Korean and English.

- [ ] **Step 2: Run the RSS tests and verify RED**

- [ ] **Step 3: Add canonical Google News channel generation**

Define immutable channel topics for top, world, and technology. Store one
canonical `hl`, `gl`, `ceid`, and three localized names per eligible locale.
Generate unique final URLs:

```js
const GOOGLE_TOPICS = ["top", "WORLD", "TECHNOLOGY"];
```

Top uses `/rss`. The other two use
`/rss/headlines/section/topic/<TOPIC>`. Append the same encoded locale query to
all three.

- [ ] **Step 4: Add the six direct fallback feeds**

Use final no-redirect URLs:

```text
https://www.dr.dk/nyheder/service/feeds/allenyheder
https://www.dr.dk/nyheder/service/feeds/indland
https://www.dr.dk/nyheder/service/feeds/udland
https://data.gmanetwork.com/gno/rss/news/nation/feed.xml
https://www.philstar.com/rss/headlines
https://www.rappler.com/feed/
```

- [ ] **Step 5: Run RSS and API tests**

Expected: ninety unique HTTPS feeds, three per locale, and every alias accepted
by the server allowlist.

- [ ] **Step 6: Commit**

```bash
git add server/news-feeds.js src/rss-sources.test.ts tests/news-api.test.mjs
git commit -m "feat: add ninety localized news channels"
```

### Task 7: Add the serial live RSS verifier

**Files:**
- Create: `scripts/verify-rss-feeds.mjs`
- Create: `tests/rss-feed-verifier.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing verifier unit tests**

Inject a fake fetch and assert acceptance of a bounded RSS response. Assert
stable failures for redirect, non-200, non-XML content type, oversized body,
missing root, missing item, and timeout.

- [ ] **Step 2: Run the verifier tests and verify RED**

```bash
node --test --test-concurrency=1 tests/rss-feed-verifier.test.mjs
```

- [ ] **Step 3: Implement bounded sequential verification**

Export `verifyFeed(feed, fetchImpl)` and `verifyAllFeeds(feeds, fetchImpl)`.
Read at most `1_000_001` bytes, use an eight-second abort timer, and return
structured results without throwing away later feed outcomes.

- [ ] **Step 4: Add the package command**

```json
"verify:rss-live": "node scripts/verify-rss-feeds.mjs"
```

- [ ] **Step 5: Run unit tests and then all ninety live checks serially**

```bash
node --test --test-concurrency=1 tests/rss-feed-verifier.test.mjs
npm run verify:rss-live
```

Expected: `90 passed, 0 failed`. Replace or correct any channel that does not
meet the approved contract, then rerun the entire live audit.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-rss-feeds.mjs tests/rss-feed-verifier.test.mjs package.json
git commit -m "test: add live RSS catalog verifier"
```

### Task 8: Documentation, browser audit, and final integration

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/i18n/adding-a-language.md`
- Modify: `docs/hardware/2026-07-29-phone-companion-completion-audit.md`

- [ ] **Step 1: Update durable documentation**

Record thirty bundled languages, RTL behavior, ninety channels, the live
verification command, and the unchanged transport baseline. Update the
language-addition guide to require direction and live-feed verification.

- [ ] **Step 2: Run every automated gate serially**

```bash
git diff --check
npm run test:repo
npm run typecheck
npm test
npm run build
node --test --test-concurrency=1 tests/*.test.mjs
npm run test:sites
npm run verify:rss-live
npm run pack
shasum -a 256 sandevistan.ehpk
```

- [ ] **Step 3: Run the browser acceptance audit**

At `402×667`, confirm thirty language options. Select and inspect one Home and
detail screen for English, Japanese, Simplified Chinese, Hindi, Thai, Arabic,
and Hebrew. Confirm Arabic and Hebrew phone roots are RTL while the nested HUD
frame remains LTR. Check browser errors after every representative selection.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md AGENTS.md docs
git commit -m "docs: document thirty-language release candidate"
```

- [ ] **Step 5: Fast-forward into `main`, rerun `npm test`, and push**

Verify local and `origin/main` commit hashes match. Confirm the canonical
Tailscale URL returns HTTP `200`. Do not tag or submit to Even Hub.

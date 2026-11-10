# Sandevistan Phone Companion Dashboard Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the diagnostic-first `/hud-canvas-fast` phone WebView with the approved Even-native companion dashboard while preserving the proven G2 Canvas, input, and image-transport behavior.

**Architecture:** Keep the 576×288 Canvas mounted in a `FastHudController`, and place a phone-only `PhoneCompanion` shell around it. Persist phone preferences, RSS sources, TODO items, and the user-owned ORS key through the existing Even storage adapter. Pass secrets only through fixed same-origin API endpoints. Split the UI into focused screens and keep all rendering/transport refreshes on the existing drop-when-busy, never-queue coordinator.

**Tech Stack:** React 19, TypeScript 5.9, Vite 6, Vitest/Testing Library, Even Hub SDK 0.0.11, Pixelarticons through local Iconify packages, Cloudflare-style Fetch API handlers.

---

## File map

New client modules:

- `src/phone-types.ts`: shared screen, page, locale, and status types.
- `src/phone-preferences.ts`: validated defaults and Even-storage persistence.
- `src/phone-i18n.ts`: type-safe Korean and English phone strings.
- `src/phone-icons.tsx`: local Pixelarticons mapping only.
- `src/phone/PhoneCompanion.tsx`: persistent Canvas host and internal screen state.
- `src/phone/PhoneHome.tsx`: preview, eight cards, and footer.
- `src/phone/PhoneHeader.tsx`: detail header and Back control.
- `src/phone/DevicesScreen.tsx`: read-only hardware state.
- `src/phone/HudLayoutScreen.tsx`: enablement and ordering.
- `src/phone/NewsScreen.tsx`: RSS source management.
- `src/phone/TodoScreen.tsx`: phone TODO CRUD.
- `src/phone/WeatherScreen.tsx`: detailed weather and manual refresh.
- `src/phone/NavigationScreen.tsx`: device-local ORS key and route controls.
- `src/phone/LanguageScreen.tsx`: System, Korean, and English selection.
- `src/phone/DeveloperScreen.tsx`: trace and diagnostics.
- `src/phone/phone-shell.css`: global phone shell and shared controls.
- `src/phone/phone-home.css`: reference-matched preview and card grid.
- `src/phone/phone-detail.css`: detail-screen lists, forms, and states.
- `src/use-fast-hud-controller.ts`: extracted bridge/live/Canvas coordination.
- `src/ors-key.ts`: local key validation, masking, headers, and persistence.
- `src/rss-sources.ts`: source model, validation, persistence, and aggregation.

Existing modules modified:

- `src/App.tsx`: route selection and composition only.
- `src/App.test.tsx`: characterization and phone-shell integration tests.
- `src/fast-hud-pages.ts`: saved order/enablement support.
- `src/live-dashboard.ts`: controlled source/key updates without a refresh queue.
- `src/news.ts`: RSS and Atom parsing plus source-labelled merging.
- `src/routing.ts`: dedicated key header and validation request.
- `src/todos.ts`: add, rename, delete, and last-item protection.
- `server/news.js`: hardened HTTPS feed proxy.
- `server/route.js`: per-request key with environment fallback.
- `server/api-router.js`: fixed ORS validation endpoint.
- `scripts/prepare-sites-build.mjs`: include any added server modules.
- `src/styles.css`: retain only legacy non-fast routes.
- `package.json` and `package-lock.json`: local Pixelarticons dependencies.

All new custom TypeScript, TSX, and CSS files stay at or below 450 lines.

### Task 1: Lock current hardware behavior and extract the controller

**Files:**
- Create: `src/use-fast-hud-controller.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add failing characterization tests**

Add tests proving that switching a phone-only `screen` state:

```tsx
expect(mocks.createContainer).toHaveBeenCalledTimes(1);
expect(mocks.createSession).toHaveBeenCalledTimes(1);
expect(mocks.sendImage).toHaveBeenCalledTimes(initialSendCount);
expect(screen.getByRole("heading", { name: "Devices" })).toBeVisible();
```

Also retain the existing assertions for tile order
`relicTR → relicBR → relicTL → relicBL`, dirty-tile skips, scroll direction,
double-tap hide/restore, and dropped busy refreshes.

- [ ] **Step 2: Run the focused test and confirm the new assertion fails**

Run:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because phone detail navigation and the extracted controller do
not exist.

- [ ] **Step 3: Extract the existing fast-HUD effect without changing logic**

Move the current bridge, live-session, input, minute timer, encode, tile-send,
and cleanup code into:

```ts
export type FastHudControllerResult = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: string;
  battery: BatteryState;
  liveState: LiveDashboardState;
  routeControls: RouteControlState;
  requestWeatherRefresh(): Promise<"accepted" | "dropped">;
};

export function useFastHudController(
  options: FastHudControllerOptions,
): FastHudControllerResult;
```

The hook must keep the existing single `refreshBusyRef` gate. It must not add a
promise chain, pending target, retry, replay, or deferred refresh.

- [ ] **Step 4: Reduce `App.tsx` to route selection and composition**

Keep legacy route output unchanged. For `/hud-canvas-fast`, call the hook once
and pass its result to a temporary companion container. Do not conditionally
mount the Canvas.

- [ ] **Step 5: Run the characterization tests**

Run:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: both commands PASS and all pre-existing transport assertions remain
unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/use-fast-hud-controller.ts
git commit -m "refactor: isolate fast HUD controller"
```

### Task 2: Add phone preference and localization foundations

**Files:**
- Create: `src/phone-types.ts`
- Create: `src/phone-preferences.ts`
- Create: `src/phone-preferences.test.ts`
- Create: `src/phone-i18n.ts`
- Create: `src/phone-i18n.test.ts`

- [ ] **Step 1: Write failing model tests**

Cover these exact defaults and invariants:

```ts
expect(DEFAULT_PHONE_PREFERENCES).toEqual({
  locale: "system",
  order: ["overview", "news", "todo", "weather"],
  enabled: ["overview", "news", "todo", "weather"],
});
expect(normalizeHudLayout({
  order: ["news", "overview", "news", "navigation"],
  enabled: ["news", "navigation"],
  navigationAvailable: false,
})).toEqual({
  order: ["overview", "news", "todo", "weather"],
  enabled: ["overview", "news", "todo", "weather"],
});
expect(resolvePhoneLocale("system", "ko-KR")).toBe("ko");
expect(resolvePhoneLocale("system", "ja-JP")).toBe("en");
expect(Object.keys(PHONE_STRINGS.ko)).toEqual(Object.keys(PHONE_STRINGS.en));
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npx vitest run src/phone-preferences.test.ts src/phone-i18n.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the modules are absent.

- [ ] **Step 3: Implement types, normalization, and persistence**

Use:

```ts
export type HudPageId =
  | "overview"
  | "news"
  | "todo"
  | "weather"
  | "navigation";
export type PhoneLocaleSetting = "system" | "ko" | "en";
export type PhoneScreen =
  | "home"
  | "devices"
  | "hud-layout"
  | "news"
  | "todo"
  | "weather"
  | "navigation"
  | "language"
  | "developer";
export const PHONE_PREFERENCES_KEY = "phone-preferences";
```

Read and write through `readCache`/`writeCache`, letting the existing adapter
produce `sandevistan:phone-preferences:v1`. Invalid stored values return the
default in memory and are not rewritten.

- [ ] **Step 4: Implement type-safe dictionaries**

Define English first, then constrain Korean with:

```ts
export type PhoneStringKey = keyof typeof en;
export const PHONE_STRINGS = {
  en,
  ko: ko satisfies Record<PhoneStringKey, string>,
};
```

Localize phone chrome only. Do not pass phone strings into G2 Canvas renderers.

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/phone-preferences.test.ts src/phone-i18n.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/phone-types.ts src/phone-preferences.ts src/phone-preferences.test.ts src/phone-i18n.ts src/phone-i18n.test.ts
git commit -m "feat: add phone preferences and localization"
```

### Task 3: Build the Even-native Home shell with local pixel icons

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/phone-icons.tsx`
- Create: `src/phone/PhoneCompanion.tsx`
- Create: `src/phone/PhoneHome.tsx`
- Create: `src/phone/PhoneHeader.tsx`
- Create: `src/phone/PhoneCompanion.test.tsx`
- Create: `src/phone/phone-shell.css`
- Create: `src/phone/phone-home.css`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install local icon packages**

```bash
npm install @iconify/react@6.0.2 @iconify-icons/pixelarticons@1.2.5
```

Expected: package lock updates and no runtime CDN dependency is introduced.

- [ ] **Step 2: Write failing Home tests**

Render the companion with fixed controller data and assert:

```tsx
expect(screen.getAllByRole("button")).toEqual(
  expect.arrayContaining([
    screen.getByRole("button", { name: /Devices/ }),
    screen.getByRole("button", { name: /HUD layout/ }),
    screen.getByRole("button", { name: /News/ }),
    screen.getByRole("button", { name: /TODO/ }),
    screen.getByRole("button", { name: /Weather/ }),
    screen.getByRole("button", { name: /Navigation/ }),
    screen.getByRole("button", { name: /Language/ }),
    screen.getByRole("button", { name: /Developer/ }),
  ]),
);
expect(screen.queryByText("Manage")).not.toBeInTheDocument();
expect(screen.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
  "href",
  "https://github.com/hmmhmmhm/sandevistan",
);
expect(screen.getByText("v0.1.0")).toBeVisible();
```

Click every full-card button and verify one Back action returns Home without
changing the supplied Canvas node identity.

- [ ] **Step 3: Run the test and confirm failure**

```bash
npx vitest run src/phone/PhoneCompanion.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the shell is absent.

- [ ] **Step 4: Implement the persistent Canvas host and card grid**

`PhoneCompanion` owns only `PhoneScreen` state. `PhoneHome` receives the same
Canvas element through a persistent preview slot; detail screens hide the slot
with layout/CSS rather than creating another Canvas.

Map cards from data:

```ts
const HOME_CARDS: readonly HomeCard[] = [
  { screen: "devices", icon: "devices", titleKey: "devices" },
  { screen: "hud-layout", icon: "layout", titleKey: "hudLayout" },
  { screen: "news", icon: "news", titleKey: "news" },
  { screen: "todo", icon: "checklist", titleKey: "todo" },
  { screen: "weather", icon: "weather", titleKey: "weather" },
  { screen: "navigation", icon: "navigation", titleKey: "navigation" },
  { screen: "language", icon: "language", titleKey: "language" },
  { screen: "developer", icon: "debug", titleKey: "developer" },
];
```

Import all icons from `@iconify-icons/pixelarticons/*` inside
`phone-icons.tsx`. Do not use remote icon URLs or custom SVG markup.

- [ ] **Step 5: Match approved reference measurements**

Use the approved tokens:

```css
:root {
  --phone-bg: #eeeeee;
  --phone-card: #ffffff;
  --phone-preview: #e0e0e0;
  --phone-text: #202020;
  --phone-muted: #888888;
  --phone-line: #d7d7d7;
}

.phone-home__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.phone-home-card {
  aspect-ratio: 1.28 / 1;
  border-radius: 8px;
}
```

Use white cards without shadows or glow. Render the HUD preview at 2:1 inside a
pale frame using grayscale and reduced opacity. At 320px, preserve a minimum
44px target and switch to one column only when two columns cannot remain usable.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npx vitest run src/phone/PhoneCompanion.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/App.tsx src/main.tsx src/phone-icons.tsx src/phone
git commit -m "feat: build Even-style phone dashboard"
```

### Task 4: Add Devices, Weather, Language, and Developer screens

**Files:**
- Create: `src/phone/DevicesScreen.tsx`
- Create: `src/phone/WeatherScreen.tsx`
- Create: `src/phone/LanguageScreen.tsx`
- Create: `src/phone/DeveloperScreen.tsx`
- Create: `src/phone/PhoneReadOnlyScreens.test.tsx`
- Create: `src/phone/phone-detail.css`
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `src/DiagnosticConsole.tsx`

- [ ] **Step 1: Write failing detail-screen tests**

Assert unavailable device values, charging text, weather fields, single-flight
manual refresh, locale changes, and diagnostics relocation:

```tsx
expect(screen.getByText("G2")).toBeVisible();
expect(screen.getByText("Unavailable")).toBeVisible();
expect(screen.getByRole("button", { name: "Refresh weather" })).toBeDisabled();
expect(screen.getByRole("radio", { name: PHONE_STRINGS.ko.languageKorean }))
  .toBeChecked();
expect(screen.queryByText("WEBVIEW TRACE")).not.toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /Developer/ }));
expect(screen.getByText("WEBVIEW TRACE")).toBeVisible();
```

- [ ] **Step 2: Run the focused tests and confirm failure**

```bash
npx vitest run src/phone/PhoneReadOnlyScreens.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the detail screens are absent.

- [ ] **Step 3: Implement screens**

Pass read-only controller snapshots as props. `WeatherScreen` invokes
`requestWeatherRefresh()` and treats `"dropped"` as a visible busy result
without retrying. `DeveloperScreen` composes `DiagnosticConsole`; no debug
markup remains on Home. `LanguageScreen` writes the chosen preference only
after the storage promise resolves and restores the previous selection on
failure.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/phone/PhoneReadOnlyScreens.test.tsx src/DiagnosticConsole.test.tsx --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/phone src/DiagnosticConsole.tsx
git commit -m "feat: add phone status and developer screens"
```

### Task 5: Connect editable HUD layout to glasses navigation

**Files:**
- Create: `src/phone/HudLayoutScreen.tsx`
- Create: `src/phone/HudLayoutScreen.test.tsx`
- Modify: `src/fast-hud-pages.ts`
- Modify: `src/fast-hud-pages.test.ts`
- Modify: `src/use-fast-hud-controller.ts`
- Modify: `src/phone/PhoneCompanion.tsx`

- [ ] **Step 1: Write failing layout and page-order tests**

Cover Overview locking, toggles, move-up/down, fallback normalization, and
navigation availability:

```ts
expect(getFastHudPages({
  order: ["overview", "weather", "news", "todo"],
  enabled: ["overview", "weather", "todo"],
  navigationAvailable: false,
})).toEqual(["overview", "weather", "todo"]);
```

In the UI, Overview has no disable or move-up action; Navigation is absent until
`navigationAvailable` is true.

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
npx vitest run src/fast-hud-pages.test.ts src/phone/HudLayoutScreen.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because saved layout input is unsupported.

- [ ] **Step 3: Implement atomic edits and page selection**

Use semantic buttons for move up/down instead of browser drag APIs, so ring
WebView accessibility is deterministic. Save a complete normalized preference
object, then update in-memory controller settings. Recompute the current page
index by page ID; if the active page becomes disabled, select Overview.

- [ ] **Step 4: Run focused and App regression tests**

```bash
npx vitest run src/fast-hud-pages.test.ts src/phone/HudLayoutScreen.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: PASS, including original general page-scroll direction.

- [ ] **Step 5: Commit**

```bash
git add src/fast-hud-pages.ts src/fast-hud-pages.test.ts src/use-fast-hud-controller.ts src/phone
git commit -m "feat: customize glasses HUD page order"
```

### Task 6: Add complete phone TODO management

**Files:**
- Create: `src/phone/TodoScreen.tsx`
- Create: `src/phone/TodoScreen.test.tsx`
- Modify: `src/todos.ts`
- Modify: `src/todos.test.ts`
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard-todo.test.ts`
- Modify: `src/phone/PhoneCompanion.tsx`

- [ ] **Step 1: Write failing TODO model tests**

Test add, trim, rename, complete/uncomplete, delete, six-item cap, 40-code-point
cap, and final-item rejection:

```ts
expect(addTodo(items, "  Buy milk  ").at(-1)?.title).toBe("Buy milk");
expect(() => addTodo(sixItems, "Seventh")).toThrowError("todo_limit");
expect(() => deleteTodo([onlyItem], onlyItem.id)).toThrowError("todo_last_item");
expect(toggleTodo([{ ...onlyItem, completed: true }], onlyItem.id)[0].completed)
  .toBe(false);
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npx vitest run src/todos.test.ts src/phone/TodoScreen.test.tsx src/live-dashboard-todo.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL for missing CRUD functions and screen.

- [ ] **Step 3: Implement model and screen**

Use code-point-safe length:

```ts
const normalizeTitle = (value: string) => Array.from(value.trim()).slice(0, 40).join("");
```

Require an explicit confirm state before deletion. Keep one item. Persist each
accepted list before committing it to screen state.

- [ ] **Step 4: Connect live state without a queue**

Expose:

```ts
session.replaceTodos(nextTodos): "accepted" | "dropped";
```

It updates the latest live state immediately. If the affected glasses region is
currently visible and transport is idle, request one refresh; if busy, log and
drop it. Never retain `nextTodos` as a pending refresh request.

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/todos.test.ts src/phone/TodoScreen.test.tsx src/live-dashboard-todo.test.ts src/App.test.tsx --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/todos.ts src/todos.test.ts src/live-dashboard.ts src/live-dashboard-todo.test.ts src/phone
git commit -m "feat: manage HUD tasks from phone"
```

### Task 7: Add RSS source persistence and multi-feed client parsing

**Files:**
- Create: `src/rss-sources.ts`
- Create: `src/rss-sources.test.ts`
- Create: `src/phone/NewsScreen.tsx`
- Create: `src/phone/NewsScreen.test.tsx`
- Modify: `src/news.ts`
- Modify: `src/news.test.ts`
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard.test.ts`
- Modify: `src/phone/PhoneCompanion.tsx`

- [ ] **Step 1: Write failing source and parser tests**

Use the fixed default:

```ts
export const DEFAULT_RSS_SOURCE = {
  id: "sbs-latest",
  name: "SBS Latest",
  url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01",
  enabled: true,
  isDefault: true,
} as const;
```

Assert HTTPS-only URLs, six-source cap, default non-deletion, default
disablement, custom rename/delete, RSS 2.0, Atom, source labels, stable
deduplication, newest-first order, and 100-item cap.

- [ ] **Step 2: Run tests and confirm failure**

```bash
npx vitest run src/rss-sources.test.ts src/news.test.ts src/phone/NewsScreen.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because multi-source support is absent.

- [ ] **Step 3: Implement source persistence and screen**

Store only normalized fields under `rss-sources`. Validate a candidate through
the same-origin proxy before saving. The default may be disabled and renamed
for display, but `id`, `url`, and `isDefault` remain immutable and Delete stays
disabled.

- [ ] **Step 4: Implement RSS/Atom aggregation**

Expose:

```ts
export async function resolveNewsLibrary(options: {
  sources: readonly RssSource[];
  cached: NewsCache | undefined;
  reading: boolean;
  now: number;
  fetchImpl: typeof fetch;
}): Promise<NewsResolution>;
```

When `reading` is true or the cache is younger than one hour, return cached
items without a network request. Fetch enabled sources concurrently inside one
operation; if a second operation starts while one is active, return
`{ status: "dropped" }`. Merge successful results with previous articles and do
not erase good cached items when one feed fails.

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/rss-sources.test.ts src/news.test.ts src/phone/NewsScreen.test.tsx src/live-dashboard.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/rss-sources.ts src/rss-sources.test.ts src/news.ts src/news.test.ts src/live-dashboard.ts src/live-dashboard.test.ts src/phone
git commit -m "feat: manage multiple RSS news sources"
```

### Task 8: Harden the server RSS proxy

**Files:**
- Modify: `server/news.js`
- Modify: `server/api-router.js`
- Modify: `tests/news-api.test.mjs`
- Modify: `tests/api-router.test.mjs`

- [ ] **Step 1: Write failing API security tests**

Add cases for:

- built-in `feed=sbs-latest`;
- percent-encoded custom `url=https://example.com/feed.xml`;
- rejection of HTTP, credentials, fragments, non-443 ports, IP literals,
  localhost, `.local`, and private/internal suffixes;
- redirect, timeout, body over 1,000,000 bytes, and non XML/RSS/Atom content;
- stable JSON error codes with no upstream body.

Representative assertion:

```js
assert.equal(response.status, 400);
assert.deepEqual(await response.json(), { error: "unsafe_feed_url" });
assert.equal(fetchImpl.mock.calls.length, 0);
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --test --test-concurrency=1 tests/news-api.test.mjs tests/api-router.test.mjs
```

Expected: FAIL because custom URLs are unsupported.

- [ ] **Step 3: Implement strict URL and response validation**

Use `new URL`, require `https:`, empty username/password/hash, port `""` or
`"443"`, hostname safety checks, `redirect: "manual"`, an eight-second
`AbortController`, and streamed byte counting capped at 1,000,000. Allow only
XML-compatible content types and bodies whose first meaningful element is
`rss`, `feed`, or `rdf:RDF`.

Built-in SBS responses may keep bounded public caching. Custom responses use:

```js
{ "Cache-Control": "no-store", "Content-Type": "application/xml; charset=utf-8" }
```

- [ ] **Step 4: Run API tests**

```bash
node --test --test-concurrency=1 tests/news-api.test.mjs tests/api-router.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/news.js server/api-router.js tests/news-api.test.mjs tests/api-router.test.mjs
git commit -m "feat: secure custom RSS proxy"
```

### Task 9: Add device-local ORS key validation and routing

**Files:**
- Create: `src/ors-key.ts`
- Create: `src/ors-key.test.ts`
- Create: `src/phone/NavigationScreen.tsx`
- Create: `src/phone/NavigationScreen.test.tsx`
- Modify: `src/routing.ts`
- Modify: `src/routing.test.ts`
- Modify: `src/RouteControls.tsx`
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `server/route.js`
- Modify: `server/api-router.js`
- Modify: `tests/route-api.test.mjs`

- [ ] **Step 1: Write failing client and server key tests**

Client expectations:

```ts
expect(validateOrsKey("")).toEqual({ ok: false, code: "empty" });
expect(maskOrsKey("abcdefghijklmnop")).toBe("abcd••••mnop");
expect(orsHeaders("secret")).toEqual({
  "x-sandevistan-ors-key": "secret",
});
```

Server expectations:

- `/api/routing-key-test` accepts the dedicated header and validates against a
  fixed ORS endpoint;
- request header wins over `env.ORS_API_KEY`;
- environment fallback works when the header is absent;
- missing key returns `routing_not_configured`;
- route/geocode responses, errors, console output, and serialized fixtures
  never contain the secret.

- [ ] **Step 2: Run tests and confirm failure**

```bash
npx vitest run src/ors-key.test.ts src/routing.test.ts src/phone/NavigationScreen.test.tsx --no-file-parallelism --maxWorkers=1
node --test --test-concurrency=1 tests/route-api.test.mjs
```

Expected: FAIL because the user-header flow is absent.

- [ ] **Step 3: Implement local key helpers and phone flow**

Use storage key `ors-key`. Accept trimmed printable values from 16 through
4,096 code units. Validation calls:

```ts
fetch("/api/routing-key-test", {
  method: "POST",
  headers: orsHeaders(candidate),
});
```

Only save after a successful response. Show a masked connected state. Delete
ends the active route, clears route cache, deletes local key, disables
Navigation, and normalizes it out of HUD order.

- [ ] **Step 4: Implement request-only server key resolution**

Use:

```js
function resolveOrsKey(request, env) {
  const supplied = request.headers.get("x-sandevistan-ors-key")?.trim();
  if (supplied) return supplied;
  return typeof env?.ORS_API_KEY === "string" ? env.ORS_API_KEY.trim() : "";
}
```

Never include the key in logs or response bodies. All routing endpoints return
`Cache-Control: no-store`. Keep ORS host and paths fixed.

- [ ] **Step 5: Run client and server tests**

```bash
npx vitest run src/ors-key.test.ts src/routing.test.ts src/phone/NavigationScreen.test.tsx src/RouteControls.test.tsx --no-file-parallelism --maxWorkers=1
node --test --test-concurrency=1 tests/route-api.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ors-key.ts src/ors-key.test.ts src/routing.ts src/routing.test.ts src/RouteControls.tsx src/phone server/route.js server/api-router.js tests/route-api.test.mjs
git commit -m "feat: configure ORS routing from phone"
```

### Task 10: Integrate live preferences without deferred work

**Files:**
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard.test.ts`
- Modify: `src/live-dashboard-refresh.ts`
- Modify: `src/use-fast-hud-controller.ts`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing no-queue integration tests**

Simulate preference, source, key, weather, location, and minute events during
one slow tile send. Assert that every competing request logs `dropped · busy`,
none runs after the first promise settles, and a later independent event may
start normally:

```ts
expect(mocks.sendImage).toHaveBeenCalledTimes(firstOperationTileCount);
slowSend.resolve();
await flushPromises();
expect(mocks.sendImage).toHaveBeenCalledTimes(firstOperationTileCount);
await triggerLaterIndependentEvent();
expect(mocks.sendImage).toHaveBeenCalledTimes(firstOperationTileCount + 2);
```

Also assert a minute event skips when another render already committed the same
minute.

- [ ] **Step 2: Run tests and confirm failure if any new path queues**

```bash
npx vitest run src/live-dashboard.test.ts src/App.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: new integration test initially FAILS until every new action uses the
single drop gate.

- [ ] **Step 3: Route all new refresh callers through the existing gate**

Update current in-memory data even when display refresh is dropped, so the next
independent event renders the latest state. Do not store a pending target,
pending promise, retry timer, or queued mutation.

- [ ] **Step 4: Run the complete client suite**

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/live-dashboard.ts src/live-dashboard.test.ts src/live-dashboard-refresh.ts src/use-fast-hud-controller.ts src/App.test.tsx
git commit -m "fix: preserve no-queue live refresh policy"
```

### Task 11: Complete build packaging and repository checks

**Files:**
- Modify: `scripts/prepare-sites-build.mjs`
- Modify: `tests/sites-worker.test.mjs`
- Modify: `app.json`
- Modify: `README.md`

- [ ] **Step 1: Add failing packaging assertions**

Assert that the production bundle contains every server module used by `server/api-router.js`. Verify that the bundle references no real ORS key. Confirm that the app remains on SDK 0.0.11:

```js
assert.equal(app.min_sdk_version, "0.0.11");
assert.equal(bundleText.includes("eyJvcmciOi"), false);
```

- [ ] **Step 2: Run packaging tests and confirm failures**

```bash
npm run build
npm run test:sites
npm run test:repo
```

Expected: any missing copied module or stale repository documentation FAILS.

- [ ] **Step 3: Update packaging and English documentation**

Copy the exact API files required by the worker. Document phone-side ORS and
RSS configuration, local-only key storage, the default SBS feed, two phone UI
languages, and the unchanged development/Even Hub warning. Keep the package
private and do not publish or deploy.

- [ ] **Step 4: Run packaging and repository tests**

```bash
npm run build
npm run test:sites
npm run test:repo
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/prepare-sites-build.mjs tests/sites-worker.test.mjs app.json README.md
git commit -m "docs: document phone companion configuration"
```

### Task 12: Perform serial visual and physical regression verification

**Files:**
- Create: `design-qa.md`
- Modify: only files that fail visual or regression verification

- [ ] **Step 1: Start one local preview**

```bash
npm run dev -- --host 0.0.0.0 --port 4176
```

Expected: one Vite process serves `/hud-canvas-fast?sdk=0.0.11`. Do not start a
second test server.

- [ ] **Step 2: Capture required phone states serially**

Using the user-approved browser workflow, capture Home at widths 320, 390, 430,
and desktop, then capture all eight detail screens. Compare Home at the same
viewport against:

`/var/folders/tf/m5t7_rdn1wn5yqy5gl4xzkl00000gn/T/codex-clipboard-AiGLUj.png`

The combined comparison must explicitly check background, card proportions,
eight-pixel-equivalent radii/gaps, pixel icons, lower labels, preview wash,
footer, focus states, and absence of Manage/debug content.

- [ ] **Step 3: Record and resolve visual findings**

Write `design-qa.md` with:

```md
# Phone Companion Design QA

- Reference viewport: <measured width>x<measured height>
- Prototype viewport: <same width>x<same height>
- Home comparison: passed
- Responsive widths: passed
- Eight detail screens: passed
- Keyboard/focus/target sizes: passed
- No glow, green tint, Manage list, or Home diagnostics: passed

final result: passed
```

If any line would be `failed`, fix it, rerun the focused test, recapture, and
compare again before writing `final result: passed`.

- [ ] **Step 4: Run final automated verification serially**

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
npm run test:repo
node --test --test-concurrency=1 tests/news-api.test.mjs
node --test --test-concurrency=1 tests/route-api.test.mjs
git diff --check
```

Expected: every command exits 0 with no failed tests or whitespace errors.

- [ ] **Step 5: Perform the physical G2 gate**

On the charged glasses, verify startup bilateral four-tile output, saved page
order, general page-scroll direction, map-only zoom inversion, news/TODO/weather
details, route guidance, and double-tap hide/restore. Leave the app idle long
enough to confirm minute/location/weather events remain responsive and do not
recreate a deferred queue.

- [ ] **Step 6: Commit and push**

```bash
git add design-qa.md
git commit -m "test: verify phone companion experience"
git push origin main
```

Expected: local `main` and `origin/main` point to the same commit. Keep the
verified local preview running for owner inspection. Do not deploy to Sites,
publish npm, submit to Even Hub, or remove the `0.0.12-reproduce` branch.

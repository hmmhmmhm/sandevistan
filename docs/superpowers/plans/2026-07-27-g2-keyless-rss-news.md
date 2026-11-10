# G2 Keyless RSS News Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all six sample headlines with current SBS latest-news RSS while keeping the feed keyless, same-origin, allowlisted, cached, and independent of other live features.

**Architecture:** A shared server API router handles `/api/*` before static assets in both the Sites Worker and Vite development server. The server proxies only the fixed SBS feed as XML. The client parses, sanitizes, deduplicates, persists, and renders six normalized headlines.

**Tech Stack:** Sites Worker, Vite Connect middleware, Fetch API, RSS XML, DOMParser, TypeScript, Node test runner, Vitest

---

### Task 1: Add one server API contract for Worker and Vite

**Files:**
- Create: `server/http.js`
- Create: `server/api-router.js`
- Create: `server/dev-api.js`
- Create: `tests/api-router.test.mjs`
- Modify: `worker/index.js`
- Modify: `vite.config.mjs`
- Modify: `scripts/prepare-sites-build.mjs`
- Modify: `tests/sites-worker.test.mjs`

- [x] **Step 1: Write failing API/static routing tests**

Assert:

```js
const api = await handleApiRequest(
  new Request("https://example.test/api/missing"),
  {},
);
assert.equal(api.status, 404);
assert.deepEqual(await api.json(), {
  error: { code: "API_NOT_FOUND", message: "Unknown RELIC API route" },
});
```

Update the Worker test to prove `/api/missing` never calls `ASSETS.fetch()`.
Keep existing static asset and HTML fallback assertions unchanged.

Update the packaging test to require:

```js
await access(new URL("../dist/server/http.js", import.meta.url));
await access(new URL("../dist/server/api-router.js", import.meta.url));
```

- [x] **Step 2: Run and verify RED**

```bash
node --test tests/api-router.test.mjs tests/sites-worker.test.mjs
```

Expected: FAIL because the shared API router and packaged server modules do not
exist.

- [x] **Step 3: Implement shared HTTP helpers and the router**

In `server/http.js`, export:

```js
export function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function readLimitedBytes(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export function createTimeout(
  milliseconds,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
) {
  const controller = new AbortController();
  const timer = setTimeoutImpl(() => controller.abort(), milliseconds);
  return {
    signal: controller.signal,
    dispose: () => clearTimeoutImpl(timer),
  };
}
```

In `server/api-router.js`, import `jsonResponse` from `./http.js` and export:

```js
export async function handleApiRequest(request, env, dependencies = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  return jsonResponse(
    { error: { code: "API_NOT_FOUND", message: "Unknown RELIC API route" } },
    { status: 404 },
  );
}
```

- [x] **Step 4: Route API before assets**

At the start of `worker/index.js`:

```js
import { handleApiRequest } from "../server/api-router.js";

const apiResponse = await handleApiRequest(request, env);
if (apiResponse) return apiResponse;
```

Retain the existing asset fetch and HTML fallback code after this branch.

In `server/dev-api.js`, export a Vite plugin that:

- converts the Connect request to a Fetch `Request`;
- buffers request bodies only for non-GET/HEAD methods;
- calls `handleApiRequest(request, process.env)`;
- calls `next()` when the result is null;
- copies status, headers, and response bytes when handled;
- converts unexpected errors to JSON `INTERNAL_ERROR` without returning a
  stack trace.

Use this request/response adapter:

```js
import { handleApiRequest } from "./api-router.js";
import { jsonResponse } from "./http.js";

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function relicDevApi() {
  return {
    name: "relic-dev-api",
    configureServer(server) {
      server.middlewares.use(async (incoming, outgoing, next) => {
        const method = incoming.method ?? "GET";
        const host = incoming.headers.host ?? "127.0.0.1";
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) headers.append(name, item);
          } else if (value !== undefined) {
            headers.set(name, value);
          }
        }
        const body = method === "GET" || method === "HEAD"
          ? undefined
          : await readRequestBody(incoming);
        const request = new Request(
          new URL(incoming.url ?? "/", `http://${host}`),
          { method, headers, body },
        );
        let response;
        try {
          response = await handleApiRequest(request, process.env);
        } catch {
          response = jsonResponse(
            { error: { code: "INTERNAL_ERROR", message: "RELIC API failed" } },
            { status: 500 },
          );
        }
        if (!response) return next();
        outgoing.statusCode = response.status;
        response.headers.forEach((value, name) => outgoing.setHeader(name, value));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
}
```

Register that plugin before `react()` in `vite.config.mjs`:

```js
import { relicDevApi } from "./server/dev-api.js";

plugins: [relicDevApi(), react()],
```

- [x] **Step 5: Package server modules**

In `scripts/prepare-sites-build.mjs`, copy these exact files into
`dist/server/`:

```js
const serverFiles = ["http.js", "api-router.js"];
for (const name of serverFiles) {
  copyFileSync(
    path.join(root, "server", name),
    path.join(dist, "server", name),
  );
}
```

Keep `dist/server/index.js` as the Worker entrypoint.

- [x] **Step 6: Verify the shared API framework and commit**

```bash
node --test tests/api-router.test.mjs tests/sites-worker.test.mjs
git add server/http.js server/api-router.js server/dev-api.js worker/index.js vite.config.mjs \
  scripts/prepare-sites-build.mjs tests/api-router.test.mjs tests/sites-worker.test.mjs
git commit -m "feat: add shared RELIC API router"
```

### Task 2: Implement the fixed SBS feed proxy

**Files:**
- Create: `server/news.js`
- Create: `tests/news-api.test.mjs`

- [x] **Step 1: Write allowlist and limit tests**

Test these requests:

```js
GET /api/news?feed=sbs-latest  -> 200 XML
GET /api/news?feed=unknown     -> 400 UNSUPPORTED_FEED
POST /api/news?feed=sbs-latest -> 404 from router
```

Assert the upstream URL is exactly:

```text
https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER
```

Assert upstream fetch options include:

```js
{
  redirect: "error",
  headers: { accept: "application/rss+xml, application/xml, text/xml" },
}
```

Add timeout, upstream non-2xx, and body-larger-than-`1_000_000` tests.

- [x] **Step 2: Run and verify RED**

```bash
node --test tests/news-api.test.mjs
```

- [x] **Step 3: Implement the proxy**

Define:

```js
const FEEDS = new Map([
  [
    "sbs-latest",
    "https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER",
  ],
]);
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
```

Export:

```js
export async function handleNewsRequest(
  request,
  _env,
  { fetchImpl = fetch, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {},
)
```

Import `jsonResponse`, `readLimitedBytes`, and `createTimeout` from
`./http.js`. Do not import from `api-router.js`.

Read the response stream incrementally and cancel it once accumulated bytes
exceed `MAX_BYTES` by calling `readLimitedBytes()` from `server/http.js`. Use
`createTimeout()` for the abort signal and always call `dispose()` in `finally`.
On success return XML with:

```text
content-type: application/rss+xml; charset=utf-8
cache-control: public, max-age=300, s-maxage=300, stale-while-revalidate=600
x-content-type-options: nosniff
```

Map failures to stable JSON codes:

```text
UNSUPPORTED_FEED 400
NEWS_TIMEOUT 504
NEWS_TOO_LARGE 502
NEWS_UPSTREAM_ERROR 502
```

Never accept an arbitrary upstream URL and never follow redirects.

- [x] **Step 4: Register and package the news endpoint**

Import `handleNewsRequest` in `server/api-router.js`, then add:

```js
if (url.pathname === "/api/news" && request.method === "GET") {
  return handleNewsRequest(request, env, dependencies);
}
```

Add `"news.js"` to `serverFiles` in the build script and require
`dist/server/news.js` in the packaging test.

- [x] **Step 5: Verify server APIs and commit**

```bash
node --test tests/news-api.test.mjs tests/api-router.test.mjs tests/sites-worker.test.mjs
git add server worker/index.js vite.config.mjs scripts/prepare-sites-build.mjs \
  tests/news-api.test.mjs tests/api-router.test.mjs tests/sites-worker.test.mjs
git commit -m "feat: proxy allowlisted SBS RSS"
```

### Task 3: Parse, sanitize, cache, and refresh six headlines

**Files:**
- Create: `src/news.ts`
- Create: `src/news.test.ts`
- Modify: `src/live-dashboard.ts`
- Modify: `src/live-dashboard.test.ts`

- [x] **Step 1: Write failing RSS parser tests**

Use RSS containing duplicate `guid`, missing dates, CDATA markup, and seven
items. Assert:

```ts
const items = parseNewsRss(xml);
expect(items[0]).toEqual({
  id: "guid:new",
  title: "First Latest Article",
  url: "https://news.sbs.co.kr/a",
  publishedAt: Date.parse("2026-07-27T05:00:00Z"),
});
expect(items).toHaveLength(6);
```

Also assert:

```ts
expect(parseNewsRss("<not-rss>")).toEqual([]);
expect(items.every(({ title }) => !/[<>]/.test(title))).toBe(true);
```

Provider tests must cover fresh cache under ten minutes, background refresh
after ten minutes, stale-cache fallback, and unavailable-without-cache.

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run src/news.test.ts src/live-dashboard.test.ts
```

- [x] **Step 3: Implement RSS normalization**

Export:

```ts
export const NEWS_MAX_AGE_MS = 10 * 60 * 1000;
export function parseNewsRss(xml: string): readonly NewsItem[];
export async function resolveNews(
  storage: EvenStorage,
  fetchImpl?: typeof fetch,
  now?: number,
  onCached?: (cached: DataState<readonly NewsItem[]>) => void,
): Promise<DataState<readonly NewsItem[]>>;
```

`parseNewsRss()` must:

1. reject XML parser errors;
2. read `item > title`, `guid`, `link`, and `pubDate`;
3. decode entities, remove markup, and collapse whitespace;
4. identify by `guid`, then `link`, then an FNV-1a title hash;
5. deduplicate before sorting;
6. sort valid dates newest first while preserving source order for missing
   dates;
7. return at most six non-empty titles.

`resolveNews()` fetches same-origin:

```text
/api/news?feed=sbs-latest
```

with an eight-second abort timeout. Persist `{ value, fetchedAt }`. Preserve a
valid stale cache on any error. Call `onCached` before a stale refresh so the
six cached titles render immediately.

- [x] **Step 4: Add news to the session**

After location startup, resolve news independently of weather:

```ts
void resolveNews(
  storage,
  fetchImpl,
  now(),
  (cached) => patch({ news: cached }, "right"),
).then((news) => {
  patch({ news }, "right");
});
```

On visible foreground, refresh only when the news cache is at least ten minutes
old. A weather failure must not alter news state, and a news failure must not
alter weather state.

- [x] **Step 5: Verify and commit**

```bash
npx vitest run src/news.test.ts src/live-dashboard.test.ts
git add src/news.ts src/news.test.ts src/live-dashboard.ts src/live-dashboard.test.ts
git commit -m "feat: load and cache six RSS headlines"
```

### Task 4: Render live headlines without changing page transport

**Files:**
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-canvas-hud.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [x] **Step 1: Write rendering tests**

Given six normalized items, assert all six shortened titles are drawn and none
of the old samples appear:

```ts
expect(news.values.filter((value) => value.startsWith("· "))).toEqual([
  "· First Latest Article",
  "· Second most recent article",
  "· Third Latest Article",
  "· Fourth Latest Article",
  "· Fifth Latest Article",
  "· Sixth Latest Article",
]);
expect(news.values).not.toContain("· Expanding AI industry investment");
```

For an empty unavailable state:

```ts
expect(news.values).toContain("NEWS UNAVAILABLE");
```

For stale data:

```ts
expect(news.values).toContain("NEWS // FOCUS · STALE");
```

The App test must also assert:

```ts
expect(screen.getByText(/News: SBS RSS · Personal·Noncommercial/)).toBeTruthy();
```

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run src/fast-canvas-hud.test.ts src/App.test.tsx
```

- [x] **Step 3: Render the news snapshot**

Pass `live.news` into `drawNews()`. Keep the existing six baseline positions:

```ts
[
  [308, 104, 14],
  [308, 128, 14],
  [308, 152, 14],
  [308, 176, 14],
  [308, 237, 13],
  [308, 257, 13],
]
```

Export a pure `truncateHudTitle(title, maxUnits)` helper. Count ASCII as one
unit and Korean/non-ASCII as two; append `…` without exceeding the unit limit.
Use 25 units for the top four and 29 for the bottom two.

The session update already requests `right`, so no transport change is allowed
in this task.

Extend the phone-only credit to:

```text
Weather: Open-Meteo · Map data: OpenStreetMap contributors · News: SBS RSS · Personal/Non-Commercial
```

- [x] **Step 4: Full verification and commit**

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
git add src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts src/App.tsx src/App.test.tsx
git commit -m "feat: render live RSS news on fast HUD"
```

### Task 5: Physical RSS checkpoint

**Files:**
- Create: `docs/hardware/2026-07-27-keyless-rss-news.md`

- [x] **Step 1: Open**

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-news-013
```

- [x] **Step 2: Verify**

Confirm that six current general-news titles are readable. Verify that one news refresh sends only `3/5`. Repeated page scrolling must not cause extra HTTP requests. In airplane mode, verify that cached titles remain visible with `STALE`.

- [x] **Step 3: Record and commit**

```bash
git add docs/hardware/2026-07-27-keyless-rss-news.md
git commit -m "docs: verify keyless RSS news on G2"
```

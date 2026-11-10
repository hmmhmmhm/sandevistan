import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { BUILT_IN_RSS_FEEDS } from "../server/news-feeds.js";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const ACCEPT = "application/rss+xml, application/atom+xml, application/xml, text/xml";

function failure(feed, error, detail, startedAt) {
  return {
    feed,
    ok: false,
    error,
    detail,
    durationMs: Date.now() - startedAt,
  };
}

async function readBoundedBody(response) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BYTES) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
}

export async function verifyFeed(
  feed,
  fetchImpl = fetch,
  {
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeoutImpl(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(feed.url, {
      redirect: "manual",
      headers: { accept: ACCEPT },
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      return failure(feed, "REDIRECT", `HTTP ${response.status}`, startedAt);
    }
    if (response.status !== 200) {
      return failure(feed, "HTTP_STATUS", `HTTP ${response.status}`, startedAt);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/(?:rss|atom|\+xml|application\/xml|text\/xml)/i.test(contentType)) {
      return failure(feed, "CONTENT_TYPE", contentType || "missing", startedAt);
    }
    const body = await readBoundedBody(response);
    if (body.tooLarge) {
      return failure(feed, "TOO_LARGE", `>${MAX_BYTES} bytes`, startedAt);
    }
    const xml = new TextDecoder().decode(body.bytes);
    if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) {
      return failure(feed, "MISSING_ROOT", "RSS/Atom root not found", startedAt);
    }
    const itemCount = [...xml.matchAll(/<(?:item|entry)\b/gi)].length;
    if (itemCount < 1) {
      return failure(feed, "MISSING_ITEM", "No item or entry found", startedAt);
    }
    return {
      feed,
      ok: true,
      itemCount,
      bytes: body.bytes.byteLength,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      return failure(feed, "TIMEOUT", `${TIMEOUT_MS}ms`, startedAt);
    }
    return failure(
      feed,
      "NETWORK",
      error instanceof Error ? error.message : String(error),
      startedAt,
    );
  } finally {
    clearTimeoutImpl(timer);
  }
}

export async function verifyAllFeeds(
  feeds,
  fetchImpl = fetch,
  dependencies,
) {
  const results = [];
  const byUrl = new Map();
  for (const feed of feeds) {
    const cached = byUrl.get(feed.url);
    if (cached) {
      results.push({ ...cached, feed, durationMs: 0 });
      continue;
    }
    const result = await verifyFeed(feed, fetchImpl, dependencies);
    byUrl.set(feed.url, result);
    results.push(result);
  }
  return results;
}

async function main() {
  const results = await verifyAllFeeds(BUILT_IN_RSS_FEEDS);
  for (const result of results) {
    if (result.ok) {
      console.log(
        `PASS ${result.feed.id} · ${result.itemCount} items`
        + ` · ${result.bytes} bytes · ${result.durationMs}ms`,
      );
    } else {
      console.error(
        `FAIL ${result.feed.id} · ${result.error}`
        + ` · ${result.detail} · ${result.durationMs}ms`,
      );
    }
  }
  const report=process.argv.find(value=>value.startsWith("--json-report="))?.slice("--json-report=".length);
  if(report) await writeFile(report,JSON.stringify(results,null,2));
  const passed = results.filter(({ ok }) => ok).length;
  const failed = results.length - passed;
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  await main();
}

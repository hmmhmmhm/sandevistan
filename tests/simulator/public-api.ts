import { apiEndpoint } from "../../src/api-endpoint";
import { parseMapResponse } from "../../src/map";
import { parseNewsFeed } from "../../src/news";
import { createInitialLiveDashboardState } from "../../src/live-state";
import { drawFastFullscreenMap } from "../../src/fast-map";

async function verify() {
  const origin = new URL(apiEndpoint("/api/health")).origin;
  if (origin !== "https://sandevistan-api.hmmhmmhm.workers.dev") throw Error("Wrong build mode");
  const health = await fetch(apiEndpoint("/api/health")).then(r => r.json());
  const mapResponse = await fetch(apiEndpoint("/api/map?lat=37.5665&lng=126.9780"));
  if (!mapResponse.ok) throw Error(`Map HTTP ${mapResponse.status}`);
  const map = parseMapResponse(await mapResponse.json());
  if (!map.roads.length || !map.labels.length || map.tileSource !== "openmaptiles") throw Error("Empty map or missing attribution");
  const newsResponse = await fetch(apiEndpoint("/api/news?feed=sbs-latest"));
  if (!newsResponse.ok) throw Error(`News HTTP ${newsResponse.status}`);
  const news = parseNewsFeed(await newsResponse.text());
  if (!news.length) throw Error("Empty RSS items");
  const routing = await fetch(apiEndpoint("/api/routing-status")).then(r => r.json());
  const canvas = document.querySelector("canvas");
  if (!canvas) throw Error("Canvas missing");
  const live = createInitialLiveDashboardState();
  drawFastFullscreenMap(canvas, {
    ...live,
    location: { status: "fresh", value: { coordinate: { latitude: 37.5665, longitude: 126.978 }, source: "live" } },
    map: { status: "fresh", value: map },
  }, 650, "ko");
  return { passed: true, origin, health: health.ok, roads: map.roads.length, labels: map.labels.length,
    tileSource: map.tileSource, newsItems: news.length, firstNewsTitle: news[0]?.title, optionalRouting: routing.enabled };
}
verify().then(result => {
  const output = document.getElementById("status");
  if (output) output.textContent = JSON.stringify(result, null, 2);
}).catch(error => {
  const output = document.getElementById("status");
  if (output) output.textContent = JSON.stringify({ passed: false, error: String(error) });
});

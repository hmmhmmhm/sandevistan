import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { drawFastCanvasHud } from "../../src/fast-canvas-hud";
import { transmitFastCanvas } from "../../src/glasses";
import { encodeCanvasTiles } from "../../src/g2-canvas";
import { parseMapResponse } from "../../src/map";
import { parseWeatherResponse } from "../../src/weather";
import { parseNewsFeed } from "../../src/news";
import { createInitialLiveDashboardState, type LiveDashboardState } from "../../src/live-state";

async function main() {
  const canvas = document.querySelector("canvas");
  if (!canvas) throw Error("Canvas missing");
  const context = canvas.getContext("2d");
  if (!context) throw Error("Context missing");
  const cases = [
    { id: "london", timeZone: "Europe/London", coordinate: { latitude: 51.5098, longitude: -0.1337 } },
    { id: "new-york", timeZone: "America/New_York", coordinate: { latitude: 40.7580, longitude: -73.9855 } },
  ];
  const metadata: unknown = await fetch("/__store_data/capture.json").then(response => response.json());
  if (!metadata || typeof metadata !== "object" || !("capturedAt" in metadata) || typeof metadata.capturedAt !== "string") throw Error("Capture timestamp missing");
  const capturedAt = new Date(metadata.capturedAt);
  const xml = await fetch("/__store_data/news.xml").then(response => response.text());
  const news = parseNewsFeed(xml, { id: "bbc-technology-preview", name: "BBC Technology" }).slice(0, 6);
  if (news.length !== 6) throw Error("Six actual English articles required");
  const states: LiveDashboardState[] = [];
  for (const city of cases) {
    const map: unknown = await fetch(`/__store_data/${city.id}-map.json`).then(response => response.json());
    const weather: unknown = await fetch(`/__store_data/${city.id}-weather.json`).then(response => response.json());
    states.push({
      ...createInitialLiveDashboardState(),
      location: { status: "fresh", value: { coordinate: city.coordinate, source: "live", accuracy: 8, heading: city.id === "london" ? 25 : 32 } },
      map: { status: "fresh", value: parseMapResponse(map), fetchedAt: capturedAt.getTime() },
      weather: { status: "fresh", value: parseWeatherResponse(weather), fetchedAt: capturedAt.getTime() },
      news: { status: "fresh", value: news, fetchedAt: capturedAt.getTime() },
      todos: { status: "fresh", value: [] },
    });
  }
  let index = 0, pending: Promise<void> = Promise.resolve();
  const originalText = context.fillText.bind(context);
  let labels: string[] = [];
  context.fillText = (value, x, y, maxWidth) => {
    labels.push(value);
    if (maxWidth === undefined) originalText(value, x, y); else originalText(value, x, y, maxWidth);
  };
  function draw() {
    const cityIndex = Math.floor(index / 2), city = cases[cityIndex], live = states[cityIndex];
    const page = index % 2 ? "news" : "overview";
    labels = [];
    const localTime = new Date(capturedAt.toLocaleString("en-US", { timeZone: city.timeZone }));
    drawFastCanvasHud(canvas!, localTime, page, { live, battery: { label: "G2", level: 86, charging: false }, mapRadiusMeters: 650 }, "en");
    if (labels.some(value => /[가-힣]/.test(value))) throw Error("Non-English HUD copy");
    const name = `${city.id}-${page}`;
    const payload = { name, png: canvas!.toDataURL("image/png"), labels, page, city: city.id, news };
    pending = fetch("/__store_artifact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(response => { if (!response.ok) throw Error("Artifact write failed"); });
    console.info("STORE_HUD_CASE " + name);
  }
  draw(); await pending;
  const bridge = await waitForEvenAppBridge();
  await transmitFastCanvas(canvas, () => {}, async () => {}, {
    dependencies: { waitForBridge: async () => bridge, encode: encodeCanvasTiles },
    imageSendConcurrency: 4, tilePaletteMode: "hud-4",
    beforeExternalRefresh: draw,
    onInput: () => { index = (index + 1) % 4; draw(); return "redraw"; },
  });
  await pending;
  console.info("STORE_HUD_READY");
}
void main().catch(error => console.error(String(error)));

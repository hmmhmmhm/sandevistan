import { AudioEvent, AudioInputSource, waitForEvenAppBridge, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createAiRuntime } from "../../src/ai-runtime";
import { createAiHudSnapshot } from "../../src/ai-hud-state";
import { createAiRealtimeSession } from "../../src/ai-realtime-session";
import { transmitFastCanvas, type FastCanvasRefreshRequest } from "../../src/glasses";
import { encodeCanvasTiles } from "../../src/g2-canvas";
import { drawFastDetailHud } from "../../src/fast-detail-hud";
import { createInitialLiveDashboardState } from "../../src/live-state";
import { createFastHudViewState, syncFastHudView } from "../../src/fast-hud-view";
const bridge = await waitForEvenAppBridge();
const canvas = document.createElement("canvas");
canvas.width = 576; canvas.height = 288;
document.body.appendChild(canvas);
let requestImage: FastCanvasRefreshRequest | undefined;
let view = { ...createFastHudViewState(), mode: "ai" as const };
const imageStats: { nativeTextUpdates: number; rebuiltPages: number; sentTileIds: number[] } = { nativeTextUpdates: 0, rebuiltPages: 0, sentTileIds: [] };
const imageUpdate = bridge.updateImageRawData.bind(bridge);
bridge.updateImageRawData = (value) => {
  if (value.containerID !== undefined) imageStats.sentTileIds.push(value.containerID);
  return imageUpdate(value);
};
const textUpdate = bridge.textContainerUpgrade.bind(bridge);
bridge.textContainerUpgrade = (value) => { imageStats.nativeTextUpdates++; return textUpdate(value); };
const rebuild = bridge.rebuildPageContainer.bind(bridge);
bridge.rebuildPageContainer = (value) => { imageStats.rebuiltPages++; return rebuild(value); };
const origin = "http://127.0.0.1:9899";
const headers = { "Content-Type": "application/json", "x-sandevistan-verifier": "memory-only" };
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let key: string | undefined;
let snapshot = createAiHudSnapshot(true);
let listener: ((event: EvenHubEvent) => void) | undefined;
let microphone = false;
const storage = new Map<string, string>();
const timeline: unknown[] = [];
const checks: unknown[] = [];
let content = "";
let pass = 0;
let capturing: Promise<void> = Promise.resolve();
const captured = new Set<string>();
const capture = (label: string) => {
  if (captured.has(label)) return;
  captured.add(label);
  const value = { label, content, snapshot, view, imageStats: { ...imageStats, sentTileIds: [...imageStats.sentTileIds] }, at: performance.now() };
  capturing = capturing.then(async () => {
    await delay(120);
    await fetch(origin + "/capture", { method: "POST", headers, body: JSON.stringify(value) });
  });
};
const runtime = createAiRuntime({
  bridge: {
    audioControl: async (open) => { microphone = open; return true; },
    onEvenHubEvent: (next) => { listener = next; return () => { listener = undefined; }; },
    getLocalStorage: async (name) => storage.get(name) ?? "",
    setLocalStorage: async (name, value) => { storage.set(name, value); return true; },
  },
  getKey: () => key, getLocale: () => "ko", getSnapshot: () => snapshot,
  onSnapshot: (next) => { snapshot = next; },
  createSession: (options) => createAiRealtimeSession({ ...options, onState: (protocol, eventType) => {
    timeline.push({ pass, at: performance.now(), eventType, phase: protocol.phase, model: protocol.model, transcriptionModel: protocol.transcriptionModel, user: protocol.userText, answer: protocol.assistantText, complete: protocol.responseComplete, error: protocol.error });
    options.onState?.(protocol, eventType);
  } }),
  refresh: async () => {
    drawImage();
    await requestImage?.("all");
    content = snapshot.transcriptLines.join("\n");
    if (snapshot.phase === "listening" && !snapshot.userText && !snapshot.turns.length) capture(`pass${pass}-listening`);
    if (snapshot.phase === "thinking" && !snapshot.assistantText) capture(`pass${pass}-thinking`);
    if (snapshot.assistantText && !snapshot.responseComplete) capture(`pass${pass}-streaming`);
  },
});
async function waitFor(test: () => boolean, ms: number) {
  const start = performance.now();
  while (!test()) {
    if (snapshot.phase === "error") throw new Error(snapshot.error ?? "AI failed");
    if (performance.now() - start > ms) throw new Error("Observation timeout");
    await delay(100);
  }
}
async function inject(name: string) {
  const bytes = await (await fetch(`/output/canvas-ai-implementation-2026-11-08/${name}.pcm`)).arrayBuffer();
  const source = new DataView(bytes);
  const count = Math.floor(bytes.byteLength / 3);
  const pcm = new Uint8Array(count * 2 + 192_000);
  const output = new DataView(pcm.buffer);
  for (let i = 0; i < count; i++) output.setInt16(i * 2, source.getInt16(Math.floor(i * 1.5) * 2, true), true);
  for (let offset = 0; offset < pcm.length; offset += 3_200) {
    if (!microphone || !listener) throw new Error("Microphone session ownership lost");
    listener({ audioEvent: new AudioEvent({ audioPcm: pcm.slice(offset, offset + 3_200), source: AudioInputSource.Glasses }) });
    await delay(100);
  }
}
function drawImage() {
  const context = { newsCount: 0, newsPageCounts: [], todoCount: 0, maneuverCount: 0, activeManeuverIndex: 0, aiLineCount: snapshot.transcriptLines.length };
  view = { ...syncFastHudView(view, context), mode: "ai" };
  drawFastDetailHud(canvas, { mode: "ai", live: createInitialLiveDashboardState(), newsIndex: 0, newsPage: 0,
    todoIndex: 0, navigationIndex: 0, ai: snapshot, aiLine: view.aiLine }, "ko");
}
drawImage();
const disposeImages = await transmitFastCanvas(canvas, () => {}, async () => {}, {
  dependencies: { waitForBridge: async () => bridge, encode: encodeCanvasTiles },
  beforeExternalRefresh: drawImage, onRefreshReady: (request) => { requestImage = request; },
  imageSendConcurrency: 4, tilePaletteMode: "hud-4",
});
let error: string | undefined;
let recognizedName = "";
let semanticOk = true;
try {
  const credential: unknown = await (await fetch(origin + "/key", { headers })).json();
  if (!credential || typeof credential !== "object" || !("key" in credential) || typeof credential.key !== "string") throw new Error("Credential unavailable");
  key = credential.key;
  for (pass = 1; pass <= 3; pass++) {
    if (!await runtime.start()) throw new Error("Start failed");
    await waitFor(() => snapshot.phase === "listening", 15_000);
    if (pass === 3) {
      await delay(2_000);
      checks.push({ pass, silence: true, noSpontaneousResponse: !snapshot.userText && !snapshot.assistantText });
      capture("pass3-silent-listening");
      await capturing;
    }
    await inject(pass === 1 ? "introduce-en" : "short");
    await waitFor(() => snapshot.responseComplete && snapshot.phase !== "displaying", 90_000);
    if (pass === 1) recognizedName = snapshot.userText.match(/name is (\w+)/i)?.[1] ?? "";
    semanticOk &&= pass === 1 ? recognizedName.toLowerCase() === "alex" : snapshot.assistantText.trim() === "2";
    checks.push({ pass, turn: 1, user: snapshot.userText, answer: snapshot.assistantText, ...(pass > 1 ? { correctAnswer: snapshot.assistantText.trim() === "2" } : { intendedName: "Alex", recognizedName }) });
    capture(`pass${pass}-answer`);
    await capturing;
    if (pass === 1) {
      await inject("recall-en");
      await waitFor(() => snapshot.responseComplete && snapshot.phase !== "displaying", 90_000);
      semanticOk &&= Boolean(recognizedName && /alex|알렉스/i.test(snapshot.assistantText));
      checks.push({ pass, turn: 2, user: snapshot.userText, answer: snapshot.assistantText, contextRemembered: Boolean(recognizedName && /alex|알렉스/i.test(snapshot.assistantText)) });
      capture("pass1-followup");
      await capturing;
    }
    await runtime.stop();
    if (microphone || listener) throw new Error("Microphone remained active after stop");
  }
  const starting = runtime.start();
  await delay(50);
  await runtime.stop();
  checks.push({ cancelledStartup: !await starting, microphoneStopped: !microphone });
} catch (value) { error = value instanceof Error ? value.message : "Unknown failure"; }
finally { await runtime.stop(); runtime.dispose(); key = undefined; await capturing; disposeImages(); }
await fetch(origin + "/result", { method: "POST", headers, body: JSON.stringify({ ok: !error && semanticOk, checks, error, timeline, imageStats, followsLatest: view.aiFollowsLatest, microphoneStopped: !microphone, source: "AI-generated 24k PCM resampled to official SDK 16k input; production runtime, view synchronization and four-image renderer" }) });
document.querySelector("#status")!.textContent = JSON.stringify({ ok: !error && semanticOk, checks, error }, null, 2);
console.info(`SIM_ASSISTANT_DONE ok=${!error}`);

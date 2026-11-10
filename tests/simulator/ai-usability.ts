import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { createAiRuntime } from "../../src/ai-runtime";
import { createAiRealtimeSession } from "../../src/ai-realtime-session";
import type { RealtimeSocket } from "../../src/ai-realtime-transport";
import { createAiHudSnapshot } from "../../src/ai-hud-state";
import { createInitialLiveDashboardState } from "../../src/live-state";
import { createConversateSnapshot } from "../../src/conversate-state";
import { createFastHudViewState, syncFastHudView, type FastHudViewState } from "../../src/fast-hud-view";
import { drawFastHudSurface } from "../../src/fast-hud-render";
import { createFastHudInputController } from "../../src/fast-hud-input-controller";
import { transmitFastCanvas, type FastCanvasRefreshRequest } from "../../src/glasses";
import { encodeCanvasTiles } from "../../src/g2-canvas";

const canvas = document.querySelector("canvas");
if (!canvas) throw Error("Canvas missing");
const bridge = await waitForEvenAppBridge();
const mode = new URL(location.href).searchParams.get("mode") ?? "blocked";
const began = performance.now();
const live = createInitialLiveDashboardState();
let view: FastHudViewState = { ...createFastHudViewState(), mode: "ai" };
let snapshot = createAiHudSnapshot(true);
let microphone = false;
let blockNext = false;
let refresh: FastCanvasRefreshRequest | undefined;
let socket: TestSocket | undefined;
let activeImages = 0;
let maxImages = 0;
let lastPhase = "";
let lastAnswer = "";
const imageIds: number[] = [];
function record(event: string) {
  const value = { event, mode, ms: Math.round(performance.now() - began), view: view.mode,
    phase: snapshot.phase, microphone, text: snapshot.assistantText, maxImages, imageIds };
  const status = document.getElementById("status");
  if (status) status.textContent = JSON.stringify(value);
  console.info("AI_UX " + JSON.stringify(value));
}
const update = bridge.updateImageRawData.bind(bridge);
bridge.updateImageRawData = async value => {
  activeImages++; maxImages = Math.max(maxImages, activeImages);
  if (value.containerID !== undefined) imageIds.push(value.containerID);
  try {
    if (blockNext) { blockNext = false; record("IMAGE_BLOCKED"); await new Promise(r => setTimeout(r, 2000)); }
    return await update(value);
  } finally { activeImages--; }
};
function context() {
  return { newsCount: 0, newsPageCounts: [], todoCount: 0, maneuverCount: 0, activeManeuverIndex: 0, aiLineCount: snapshot.transcriptLines.length };
}
function draw() {
  if (!canvas) return;
  view = syncFastHudView(view, context());
  drawFastHudSurface({ canvas, page: "ai", view, live, ai: snapshot,
    conversate: createConversateSnapshot(), mapRadiusMeters: 650, locale: "ko" });
}
class TestSocket implements RealtimeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  server(value: unknown) { if (this.readyState === 1) this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(value) })); }
  send(text: string) {
    const value = JSON.parse(text);
    if (value.type === "session.update") setTimeout(() => this.server({ type: "session.updated" }), 800);
    if (value.type === "response.create" && mode !== "stall") {
      this.server({ type: "response.created", response: { id: "answer" } });
      setTimeout(() => {
        blockNext = mode === "blocked";
        this.server({ type: "response.output_text.delta", response_id: "answer", delta: "받은 답변은 한 글자씩 기다리지 않고 함께 표시됩니다. 이전 화면으로 언제든 돌아갈 수 있습니다." });
        setTimeout(() => this.server({ type: "response.done", response: { id: "answer", status: "completed" } }), 3000);
      }, 500);
    }
  }
  close() { this.readyState = 3; this.onclose?.(); record("SOCKET_CLOSED"); }
}
const runtime = createAiRuntime({
  bridge: { getLocalStorage: async () => "", setLocalStorage: async () => { await new Promise(r => setTimeout(r, 1500)); return true; },
    audioControl: async open => { microphone = open; record(open ? "MIC_OPEN" : "MIC_CLOSE"); return true; },
    onEvenHubEvent: listener => bridge.onEvenHubEvent(listener) },
  getKey: () => "sk-test-synthetic-not-a-real-credential", getLocale: () => "ko", getSnapshot: () => snapshot,
  onSnapshot: next => {
    snapshot = next;
    if (lastPhase !== next.phase) { lastPhase = next.phase; record("PHASE"); }
    if (lastAnswer !== next.assistantText) { lastAnswer = next.assistantText; record("TEXT_BATCH"); }
  },
  refresh: () => refresh?.("all"),
  createSession: options => createAiRealtimeSession({ ...options,
    fetchImpl: async input => Response.json(String(input).endsWith("/models") ? { data: [] } : { value: "ek_test_ephemeral_123456" }),
    createSocket: () => { socket = new TestSocket(); const current = socket; queueMicrotask(() => { current.readyState = 1; current.onopen?.(); }); return current; },
  }),
});
const input = createFastHudInputController({ getView: () => view,
  setView: next => { view = next; if (next.mode === "dashboard") record("EXIT_LOGICAL"); },
  getPage: () => "ai", getContext: context, getLiveSession: () => undefined, getAiRuntime: () => runtime,
  drawCurrentPage: draw,
});
draw();
const dispose = await transmitFastCanvas(canvas, () => {}, async () => {}, {
  dependencies: { waitForBridge: async () => bridge, encode: encodeCanvasTiles }, imageSendConcurrency: 4, tilePaletteMode: "hud-4",
  beforeExternalRefresh: draw, onRefreshReady: value => { refresh = value; }, onInput: input,
  onDisplayCommitted: () => record("DISPLAY_COMMITTED"),
});
await runtime.start(); record("READY");
setTimeout(() => {
  socket?.server({ type: "input_audio_buffer.speech_started", item_id: "question" });
  socket?.server({ type: "input_audio_buffer.speech_stopped", item_id: "question" });
  socket?.server({ type: "conversation.item.input_audio_transcription.completed", item_id: "question", transcript: "답변 표시 속도를 확인합니다." });
}, 5000);
window.addEventListener("pagehide", () => { runtime.dispose(); dispose(); });

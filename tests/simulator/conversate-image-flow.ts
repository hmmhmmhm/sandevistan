import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { transmitFastCanvas, type FastCanvasRefreshRequest } from "../../src/glasses";
import { encodeCanvasTiles } from "../../src/g2-canvas";
import { createConversateRuntime } from "../../src/conversate-runtime";
import { createConversateSnapshot, DEFAULT_CONVERSATE_SETTINGS } from "../../src/conversate-state";
import { createFastHudInputController } from "../../src/fast-hud-input-controller";
import { createFastHudViewState, type FastHudViewState } from "../../src/fast-hud-view";
import { drawFastHudSurface } from "../../src/fast-hud-render";
import { createInitialLiveDashboardState } from "../../src/live-state";
import { createAiHudSnapshot } from "../../src/ai-hud-state";
const bridge = await waitForEvenAppBridge();
const canvas = document.createElement("canvas");
canvas.width = 576; canvas.height = 288; document.body.appendChild(canvas);
const storage = new Map<string, string>();
let snapshot = createConversateSnapshot();
let view: FastHudViewState = { ...createFastHudViewState(), mode: "conversate" };
let request: FastCanvasRefreshRequest | undefined;
const settings = { ...DEFAULT_CONVERSATE_SETTINGS, informSeconds: 3 };
const draw = () => {
  drawFastHudSurface({ canvas, page: "conversate", view, live: createInitialLiveDashboardState(), mapRadiusMeters: 600,
    ai: createAiHudSnapshot(false), conversate: snapshot, conversateSettings: settings, locale: "ko" });
  const state = { mode: view.mode, inform: snapshot.activeInform?.id, history: snapshot.informHistoryOpen,
    selectedInform: snapshot.selectedInform, copilot: snapshot.copilotOpen, selectedSuggestion: snapshot.selectedSuggestion };
  document.querySelector("#status")!.textContent = JSON.stringify(state);
  console.info(`SIM_CONVERSATE_IMAGE_STATE ${JSON.stringify(state)}`);
};
const runtime = createConversateRuntime({
  bridge: { audioControl: async () => true, onEvenHubEvent: () => () => {},
    getLocalStorage: async (key) => storage.get(key) ?? "",
    setLocalStorage: async (key, value) => { storage.set(key, value); return true; } },
  getKey: () => "sk-test-1234567890abcdefghijklmnop", getLocale: () => "ko", getSettings: () => settings,
  getSnapshot: () => snapshot, onSnapshot: (next) => { snapshot = next; },
  refresh: async () => { draw(); await request?.("all"); },
  createSession: () => ({ start: async () => {}, stop: async () => {} }),
});
await runtime.start();
const at = new Date().toISOString();
const first = { id: "first", at, text: "금요일 3시 참석 가능 여부를 먼저 확인하세요." };
const second = { id: "second", at, text: "검토할 자료와 회의 시간을 함께 확인하세요." };
snapshot = { ...snapshot, segments: [{ id: "one", at, text: "Can we meet on Friday?", translation: "금요일에 만날까요?" }],
  activeInform: first, informs: [first, second], suggestions: [
    { style: "direct", original: "Friday works for me.", pronunciation: "프라이데이 웍스 포 미", meaning: "금요일 괜찮아요." },
    { style: "warm", original: "Could we meet at three?", pronunciation: "쿠드 위 밋 앳 쓰리", meaning: "세 시에 만날까요?" },
  ] };
const input = createFastHudInputController({
  getView: () => view, setView: (next) => { view = next; }, getPage: () => "conversate",
  getContext: () => ({ newsCount: 0, newsPageCounts: [], todoCount: 0, maneuverCount: 0, activeManeuverIndex: 0 }),
  getLiveSession: () => undefined, getAiRuntime: () => undefined, getConversateRuntime: () => runtime, drawCurrentPage: draw,
});
draw();
await transmitFastCanvas(canvas, () => {}, async () => {}, {
  dependencies: { waitForBridge: async () => bridge, encode: encodeCanvasTiles },
  imageSendConcurrency: 4, tilePaletteMode: "hud-4", beforeExternalRefresh: draw,
  onRefreshReady: (value) => { request = value; }, onInput: input,
});
console.info("SIM_CONVERSATE_IMAGE_FLOW_READY");

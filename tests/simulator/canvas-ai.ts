import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { transmitFastCanvas, type FastCanvasRefreshRequest } from "../../src/glasses";
import { drawFastDetailHud } from "../../src/fast-detail-hud";
import { createInitialLiveDashboardState } from "../../src/live-state";
import { createAiHudSnapshot, type AiHudSnapshot } from "../../src/ai-hud-state";
import { createAiTranscriptLines } from "../../src/ai-transcript";
import { createConversateSnapshot, type ConversateSnapshot } from "../../src/conversate-state";

const element = document.querySelector("canvas");
if (!element) throw new Error("Canvas missing");
const canvas = element;
const bridge = await waitForEvenAppBridge();
const live = createInitialLiveDashboardState();
const at = new Date().toISOString();
const base = createAiHudSnapshot(true);
const answer: AiHudSnapshot = { ...base, phase: "listening", responseComplete: true,
  userText: "벡터 데이터베이스를 쉽게 설명해 줘.",
  assistantText: "문장을 숫자 좌표로 저장해서, 단어가 달라도 의미가 비슷한 정보를 찾아주는 데이터베이스예요. 예를 들어 ‘점심 먹을 곳’을 검색하면 ‘근처 맛집’도 찾을 수 있어요.",
  transcriptLines: [],
};
const inform = { id: "tip", at, text: "상대는 다음 주 금요일 오후 3시를 제안했습니다. 먼저 참석 가능 여부를 짧게 답하고, 어렵다면 가능한 시간을 한 가지 제시하세요. 프로젝트 검토 범위와 준비할 자료를 확인하면 일정 변경이나 불필요한 추가 질문을 줄일 수 있습니다. 확정 전에는 참석자들의 동의도 확인하세요." };
const conversate: ConversateSnapshot = { ...createConversateSnapshot(), phase: "listening",
  segments: [{ id: "one", at, text: "Can we review the project next Friday at three?", translation: "다음 주 금요일 오후 3시에 프로젝트를 검토할까요?" }],
  activeInform: inform, informs: [inform],
  suggestions: [{ style: "warm", original: "Friday at three works for me.", pronunciation: "프라이데이 앳 쓰리 웍스 포 미", meaning: "금요일 3시 괜찮아요." }],
};
type Case = { name: string; ai: AiHudSnapshot } | { name: string; conversate: ConversateSnapshot };
const cases: Case[] = [
  { name: "ai-listening", ai: { ...base, phase: "listening" } },
  { name: "ai-thinking", ai: { ...answer, phase: "thinking", assistantText: "", responseComplete: false } },
  { name: "ai-answer", ai: answer },
  { name: "ai-history", ai: { ...answer, turns: [{ user: "내 이름은 Alex야.", assistant: "Alex라고 부를게요." }], userText: "내 이름이 뭐지?", assistantText: "Alex예요." } },
  { name: "ai-approval", ai: { ...base, phase: "thinking", pendingApproval: { id: "one", serverLabel: "docs", serverName: "Project docs", toolName: "search", argumentsSummary: 'query: "release checklist"' } } },
  { name: "ai-error", ai: { ...base, phase: "error", error: "연결이 종료되었습니다. 다시 대화를 시작해 주세요." } },
  { name: "conversate-all", conversate },
  { name: "conversate-copilot", conversate: { ...conversate, copilotOpen: true } },
  { name: "conversate-no-tip", conversate: { ...conversate, activeInform: undefined } },
  { name: "conversate-history", conversate: { ...conversate, informHistoryOpen: true } },
  { name: "conversate-partial", conversate: { ...conversate, suggestions: [], partial: "이번 일정은 금요일 오후 세 시에 시작합니다." } },
  { name: "conversate-error", conversate: { ...conversate, phase: "error", error: "OpenAI 키가 필요합니다." } },
];
let index = 0;
let request: FastCanvasRefreshRequest | undefined;
const sends: number[] = [];
const update = bridge.updateImageRawData.bind(bridge);
bridge.updateImageRawData = (value) => { if (value.containerID !== undefined) sends.push(value.containerID); return update(value); };
function draw() {
  const current = cases[index];
  if (!current) return;
  const ai = "ai" in current ? { ...current.ai, transcriptLines: createAiTranscriptLines(current.ai.turns, { user: current.ai.userText, assistant: current.ai.assistantText }) } : undefined;
  drawFastDetailHud(canvas, { mode: ai ? "ai" : "conversate", live, newsIndex: 0, newsPage: 0, todoIndex: 0, navigationIndex: 0,
    ...(ai ? { ai, aiLine: Math.max(0, ai.transcriptLines.length - 1) } : {}),
    ...("conversate" in current ? { conversate: current.conversate } : {}),
  }, "ko");
  document.querySelector("#status")!.textContent = JSON.stringify({ index, name: current.name, sends });
  console.info(`SIM_CANVAS_AI case=${current.name}`);
}
draw();
await transmitFastCanvas(canvas, () => {}, async () => {}, {
  dependencies: { waitForBridge: async () => bridge, encode: (await import("../../src/g2-canvas")).encodeCanvasTiles },
  imageSendConcurrency: 4, tilePaletteMode: "hud-4",
  beforeExternalRefresh: draw,
  onRefreshReady: (value) => { request = value; },
  onInput: () => { index = (index + 1) % cases.length; draw(); return "redraw"; },
});
// The refresh reference also allows direct readback of the acknowledged production path.
if (!request) throw new Error("Image refresh missing");
console.info("SIM_CANVAS_AI_READY");

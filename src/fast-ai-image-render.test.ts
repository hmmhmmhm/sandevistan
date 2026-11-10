import { getReleaseCopy } from "./release-i18n";
import { expect, it } from "vitest";
import { drawFastConversateDetail } from "./fast-conversate-detail";
import { drawFastAiDetail } from "./fast-ai-detail";
import { createConversateSnapshot, DEFAULT_CONVERSATE_SETTINGS } from "./conversate-state";
import { createAiHudSnapshot } from "./ai-hud-state";
import { createAiTranscriptLines } from "./ai-transcript";
import { translateAiApproval } from "./ai-hud-i18n";

function drawing() {
  const texts: Array<{ value: string; x: number; y: number; size: number }> = [];
  const raw = { font: "", fillStyle: "", textAlign: "", textBaseline: "",
    fillRect() {}, beginPath() {}, arc() {}, fill() {},
    measureText(value: string) {
      const size = Number(raw.font.match(/(\d+)px/)?.[1] ?? 12);
      return { width: [...value].reduce((sum, c) => sum + (c.charCodeAt(0) < 128 ? .6 : 1) * size, 0) };
    },
    fillText(value: string, x: number, y: number) { texts.push({ value, x, y, size: Number(raw.font.match(/(\d+)px/)?.[1] ?? 12) }); },
  };
  return { context: raw as unknown as CanvasRenderingContext2D, texts };
}
it("keeps four Inform lines, caption, translation and Copilot inside the approved image", () => {
  const { context, texts } = drawing();
  const at = new Date().toISOString();
  drawFastConversateDetail(context, { ...createConversateSnapshot(), phase: "listening",
    activeInform: { id: "tip", at, text: "프로젝트 일정과 참석 가능 여부를 먼저 확인하세요. ".repeat(12) },
    segments: [{ id: "turn", at, text: "Can we meet next Friday at three?", translation: "다음 주 금요일 세 시에 만날까요?" }],
    suggestions: [{ style: "warm", original: "Friday works for me.", pronunciation: "프라이데이 웍스 포 미", meaning: "금요일 괜찮아요." }],
  }, "ko");
  expect(texts.filter(({ size }) => size === 15)).toHaveLength(4);
  expect(texts.some(({ value }) => value.includes("Can we meet"))).toBe(true);
  expect(texts.some(({ value }) => value.startsWith("→"))).toBe(true);
  expect(texts.some(({ value }) => value === "Friday works for me.")).toBe(true);
  expect(texts.every(({ y, size }) => y >= 0 && y + size <= 288)).toBe(true);
  const informBottom = Math.max(...texts.filter(({ size }) => size === 15).map(({ y, size }) => y + size));
  const caption = texts.filter(({ size }) => size === 17);
  const translation = texts.filter(({ size, value }) => size === 16 && value.startsWith("→"));
  expect(caption.every(({ y }) => y > informBottom)).toBe(true);
  expect([...caption, ...translation].every(({ y, size }) => y + size < 220)).toBe(true);
});
it("preserves the user role when browsing a wrapped continuation", () => {
  const { context, texts } = drawing();
  const userText = "긴 질문을 한 줄씩 살펴봅니다. ".repeat(10);
  const transcriptLines = createAiTranscriptLines([], { user: userText, assistant: "답변" });
  drawFastAiDetail(context, { ...createAiHudSnapshot(true), phase: "listening", userText, transcriptLines }, 8, "ko");
  expect(texts.some(({ value, size }) => value === "사용자" && size === 9)).toBe(true);
  expect(texts.filter(({ size }) => size === 18).length).toBeGreaterThan(0);
  expect(texts.every(({ y, size }) => y + size <= 288)).toBe(true);
});
it("keeps approval actions and connection errors visible in the image renderer", () => {
  const approval = drawing();
  drawFastAiDetail(approval.context, { ...createAiHudSnapshot(true), phase: "thinking",
    pendingApproval: { id: "one", serverLabel: "docs", serverName: "Docs", toolName: "search", argumentsSummary: "release checklist" },
  }, 0, "ko");
  const copy = translateAiApproval("ko");
  expect(approval.texts.some(({ value }) => value === copy.approve)).toBe(true);
  expect(approval.texts.some(({ value }) => value === copy.reject)).toBe(true);
  const error = drawing();
  drawFastAiDetail(error.context, { ...createAiHudSnapshot(true), phase: "error", error: "Connection closed" }, 0, "en");
  expect(error.texts.map(({ value }) => value).join(" ")).toContain(getReleaseCopy("en", "errorConnection"));
});

it("does not say the microphone is listening while still connecting", () => {
  const { context, texts } = drawing();
  drawFastConversateDetail(context, { ...createConversateSnapshot(), phase: "connecting" }, "ko");
  expect(texts.some(({ value }) => value === "듣는 중…")).toBe(false);
});

it("localizes the missing-key error in each image detail", () => {
  const ai = drawing();
  drawFastAiDetail(ai.context, { ...createAiHudSnapshot(false), error: "OpenAI key required" }, 0, "ko");
  expect(ai.texts.some(({ value }) => value === getReleaseCopy("ko", "openAiSetupTitle"))).toBe(true);
  expect(ai.texts.some(({ value }) => value === "준비됨")).toBe(false);
  const conversate = drawing();
  drawFastConversateDetail(conversate.context, { ...createConversateSnapshot(), phase: "error", error: "OpenAI key required" }, "ko");
  expect(conversate.texts.map(({ value }) => value).join(" ")).toContain(getReleaseCopy("ko", "openAiSetupPath"));
});

it("respects disabled auxiliary features while keeping the caption visible", () => {
  const { context, texts } = drawing();
  const at = new Date().toISOString();
  drawFastConversateDetail(context, { ...createConversateSnapshot(), phase: "listening",
    activeInform: { id: "one", at, text: "Hidden tip" },
    segments: [{ id: "turn", at, text: "Caption stays visible", translation: "Hidden translation" }],
    suggestions: [{ style: "direct", original: "Hidden reply", pronunciation: "Hidden sound", meaning: "Hidden meaning" }],
  }, "en", { ...DEFAULT_CONVERSATE_SETTINGS, inform: false, translation: false, copilot: false });
  expect(texts.some(({ value }) => value === "Caption stays visible")).toBe(true);
  expect(texts.some(({ value }) => value.includes("Hidden"))).toBe(false);
});

it("uses the selected large top status band and keeps dialogue below it", () => {
  const { context, texts } = drawing();
  const userText = "짧은 질문입니다";
  drawFastAiDetail(context, { ...createAiHudSnapshot(true), phase: "listening", userText,
    transcriptLines: createAiTranscriptLines([], { user: userText, assistant: "" }) }, 0, "ko");
  expect(texts.some(t => t.size >= 24 && t.y < 80)).toBe(true);
  expect(texts.filter(t => t.size === 18 && t.value.includes(userText)).every(t => t.y >= 110)).toBe(true);
});

it("keeps an old source and its translation above the new live partial", () => {
  const { context, texts } = drawing();
  drawFastConversateDetail(context, { ...createConversateSnapshot(), phase: "listening", partial: "New question",
    segments: [{ id: "old", at: "2026-11-08", text: "Old question", translation: "Old translation" }],
  }, "en");
  expect(texts.some(t => t.value === "New question")).toBe(true);
  const drawn = texts.filter(t => t.y >= 143 && t.y < 220).map(t => t.value);
  expect(drawn).toEqual(["Old question", "→ Old translation", "New question"]);
});

it("preserves received answer text if the connection subsequently errors", () => {
  const { context, texts } = drawing();
  const answer = "Received answer";
  drawFastAiDetail(context, { ...createAiHudSnapshot(true), phase: "error", error: "AI response timed out", assistantText: answer,
    transcriptLines: createAiTranscriptLines([], { user: "Question", assistant: answer }) }, 1, "en");
  expect(texts.some(t => t.value === answer)).toBe(true);
});
it("keeps transcript row positions fixed as timed cues and the directory appear or expire", () => {
  const snapshot = { ...createConversateSnapshot(), phase: "listening" as const,
    segments: [{ id: "one", at: "2026-11-08", text: "Earlier source", translation: "Earlier translation" }, { id: "two", at: "2026-11-08", text: "Latest source", translation: "Latest translation" }] };
  const initial = drawing(); drawFastConversateDetail(initial.context,snapshot,"en");
  const primary = (items: typeof initial.texts) => items.filter(t => t.y >= 143 && t.y < 220);
  for (const directory of [undefined, { mode: "list" as const }]) {
    const timed = drawing(); drawFastConversateDetail(timed.context,{ ...snapshot,directory,
      activeInform: { id: "tip", at: "2026-11-08", text: "New cue", expiresAt: Date.now()+7000 },
      suggestions: [{ original: "A reply", pronunciation: "a", meaning: "reply", style: "direct" }],copilotExpiresAt:Date.now()+9000 },"en");
    expect(primary(timed.texts)).toEqual(primary(initial.texts));
    expect(timed.texts.some(t => t.value.includes("7s until hidden"))).toBe(true);
  }
});
it("reopens expired Inform and Copilot without a countdown while keeping current captions", () => {
  const now = Date.now(), suggestion = { original: "A saved reply", pronunciation: "saved", meaning: "meaning", style: "direct" };
  const snapshot = { ...createConversateSnapshot(),phase: "listening" as const,partial: "Still transcribing",partialItemId:"live",
    informs: [{ id: "old-tip",at:new Date(now-20000).toISOString(),text:"A saved Inform" }],
    copilotHistory: [{ id:"old-reply",at:new Date(now-20000).toISOString(),suggestions:[suggestion] }] };
  for (const directory of [{ mode:"inform" as const,id:"old-tip",row:0 },{ mode:"copilot" as const,id:"old-reply",suggestion:0 }]) {
    const result = drawing(); drawFastConversateDetail(result.context,{ ...snapshot,directory },"en");
    expect(result.texts.some(t => t.value === "Still transcribing")).toBe(true);
    expect(result.texts.some(t => t.value === (directory.mode === "inform" ? "A saved Inform" : "A saved reply"))).toBe(true);
    expect(result.texts.some(t => t.value.includes("until hidden"))).toBe(false);
  }
});


it("reports the actual cropped rows, remaining lines and end of an Ask AI answer", () => {
  const transcriptLines = Array.from({ length: 37 }, (_, i) => `${i ? "      " : "AI // "}Line ${i + 1}`);
  const snapshot = { ...createAiHudSnapshot(true), phase: "listening" as const, transcriptLines };
  for (const end of [0, 12, 36]) {
    const { context, texts } = drawing();
    drawFastAiDetail(context, snapshot, end, "ko");
    const body = texts.filter(t => t.size === 18);
    const first = end - body.length + 1;
    const footer = texts.find(t => t.y === 268 && t.value.startsWith("▲"));
    expect(footer?.value).toContain(`${first + 1}–${end + 1}/37`);
    expect(footer?.value).toContain(end === 36 ? "끝" : `아래 ${36 - end}줄`);
    expect(footer?.x).toBeGreaterThan(180);
  }
  const { context, texts } = drawing();
  drawFastAiDetail(context, { ...snapshot, transcriptLines: [...transcriptLines, "      New streaming line"] }, 12, "ko");
  expect(texts.find(t => t.y === 268 && t.value.startsWith("▲"))?.value).toContain("9–13/38");
});

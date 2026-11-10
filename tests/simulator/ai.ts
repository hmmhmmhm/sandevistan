import { CreateStartUpPageContainer, waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { createNativeAiTextPage, createNativeAiTextModeController, createNativeAiTextContent } from "../../src/native-ai-text";
import { createAiHudSnapshot, updateAiHudProtocol } from "../../src/ai-hud-state";
import { createRealtimeProtocolState, reduceRealtimeServerEvent } from "../../src/ai-realtime-protocol";
import { createConversateSnapshot, DEFAULT_CONVERSATE_SETTINGS } from "../../src/conversate-state";
import { createNativeConversateContent } from "../../src/native-conversate-text";

const bridge = await waitForEvenAppBridge();
const initial = createNativeAiTextPage("OFFLINE FIXTURE READY\nClick to advance. No live AI calls.");
const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
  containerTotalNum: initial.containerTotalNum, textObject: initial.textObject,
}));
if (result !== 0) throw new Error(`Fixture startup failed: ${result}`);
const controller = createNativeAiTextModeController({
  bridge, createImagePage: () => createNativeAiTextPage("OFFLINE FIXTURE EXIT\nNo microphone is active."),
});
let protocol = createRealtimeProtocolState();
for (const event of [
  { type: "conversation.item.input_audio_transcription.completed", transcript: "회의를 금요일로 바꿔도 될까요?" },
  { type: "response.output_text.delta", delta: "금요일 오후가 좋겠습니다. 참석자들의 일정을 확인해 보세요." },
]) protocol = reduceRealtimeServerEvent(protocol, event);
const snapshot = updateAiHudProtocol(createAiHudSnapshot(true), protocol);
const states = [
  ["listening", createNativeAiTextContent({ ...snapshot, phase: "listening" }, Math.max(0, snapshot.transcriptLines.length - 1), "ko")],
  ["thinking", createNativeAiTextContent({ ...snapshot, phase: "thinking" }, Math.max(0, snapshot.transcriptLines.length - 1), "ko")],
  ["web-search", createNativeAiTextContent({ ...snapshot, activeTool: { id: "fixture-search", kind: "web-search" }, phase: "thinking" }, Math.max(0, snapshot.transcriptLines.length - 1), "ko")],
  ["approval", createNativeAiTextContent({ ...snapshot, pendingApproval: {
    id: "offline-approval", serverName: "Fixture server", serverLabel: "fixture", toolName: "lookup", argumentsSummary: '{"topic":"demo"}',
  } }, Math.max(0, snapshot.transcriptLines.length - 1), "ko")],
  ["error", createNativeAiTextContent({ ...snapshot, phase: "error", error: "Web search failed" }, Math.max(0, snapshot.transcriptLines.length - 1), "ko")],
  ["conversate", ((content) => [content.inform, content.body].join("\n\n"))(createNativeConversateContent({
    ...createConversateSnapshot(), phase: "listening", segments: [
      { id: "fixture-1", text: "Could we move the meeting to Friday?", translation: "회의를 금요일로 옮길 수 있을까요?", language: "en", at: new Date().toISOString() },
    ], activeInform: { id: "inform", text: "Friday is the proposed meeting day.", at: new Date().toISOString() },
  }, "ko", DEFAULT_CONVERSATE_SETTINGS))],
];
let index = 0;
let busy = false;
bridge.onEvenHubEvent((event) => {
  const envelope = event.textEvent ?? event.sysEvent;
  if (!envelope) return;
  const type = envelope.eventType ?? 0;
  console.info(`SIM_INPUT type=${type}`);
  if (busy) return;
  if (type !== 0 && type !== 3) return;
  busy = true;
  void (async () => {
    if (type === 3) {
      if (!await controller.leave()) throw new Error("Fixture leave failed");
      console.info("SIM_STATE exit");
    } else {
      const [name, content] = states[index % states.length];
      const ok = controller.active() ? await controller.update(content) : await controller.enter(content);
      if (!ok) throw new Error(`Fixture native update failed: ${name}`);
      document.querySelector("#status")!.textContent = name;
      console.info(`SIM_STATE ${name}`);
      index += 1;
    }
  })().catch((error) => console.error(error)).finally(() => { busy = false; });
});
console.info("SIM_FIXTURE_READY");

import { CreateStartUpPageContainer, waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { createNativeAiTextPage, createNativeAiTextContent, createNativeAiTextModeController } from "../../src/native-ai-text";
import { createNativeConversateMode, createNativeConversateContent } from "../../src/native-conversate-text";
const bridge = await waitForEvenAppBridge();
const page = createNativeAiTextPage("SYNTHETIC AUDIO TEST READY");
await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: page.textObject }));
const controller = createNativeConversateMode({ bridge, createImagePage: () => createNativeAiTextPage("LIVE TEST FINISHED") });
const assistant = createNativeAiTextModeController({ bridge, createImagePage: () => createNativeAiTextPage("LIVE TEST FINISHED") });
let revision = -1;
let busy = false;
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    const response = await fetch("/output/simulator-audit-2026-11-08/live-snapshot.json", { cache: "no-store" });
    if (!response.ok) return;
    const value = await response.json();
    if (value.revision === revision) return;
    let ok;
    if (value.kind === "assistant") {
      if (controller.active()) await controller.leave();
      const content = createNativeAiTextContent(value.snapshot, Math.max(0, value.snapshot.transcriptLines.length - 1), "ko");
      ok = assistant.active() ? await assistant.update(content) : await assistant.enter(content);
    } else {
      if (assistant.active()) await assistant.leave();
      const content = createNativeConversateContent(value.snapshot, "ko", value.settings);
      ok = controller.active() ? await controller.update(content) : await controller.enter(content);
    }
    if (!ok) throw new Error("Live fixture native update failed");
    revision = value.revision;
    document.querySelector("#status")!.textContent = `${revision} ${value.snapshot.phase}`;
    console.info(`SIM_LIVE revision=${revision} phase=${value.snapshot.phase}`);
  } finally { busy = false; }
}, 200);
console.info("SIM_LIVE_READY");

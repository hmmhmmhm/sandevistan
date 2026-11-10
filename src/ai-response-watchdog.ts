import type { AiRealtimeProtocolState } from "./ai-realtime-protocol";

export function createAiResponseWatchdog(onTimeout: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let previous: AiRealtimeProtocolState | undefined;
  let began = 0;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  return {
    clear() { clear(); previous = undefined; },
    observe(state: AiRealtimeProtocolState) {
      if (state.phase !== "thinking" || state.pendingApproval) {
        clear(); previous = undefined; return;
      }
      const now = Date.now();
      if (!previous) began = now;
      const progressed = !previous || previous.userText !== state.userText
        || previous.assistantText !== state.assistantText
        || previous.activeResponseId !== state.activeResponseId
        || previous.activeTool !== state.activeTool;
      previous = state;
      if (!progressed) return;
      clear();
      timer = setTimeout(() => { timer = undefined; previous = undefined; onTimeout(); },
        Math.max(0, Math.min(20_000, 90_000 - (now - began))));
    },
  };
}

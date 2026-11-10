import { AudioInputSource } from "@evenrealities/even_hub_sdk";
import type { AiRealtimeSessionOptions } from "./ai-realtime-session-types";

export function createAiMicrophone(bridge: AiRealtimeSessionOptions["bridge"], onPcm: (bytes: Uint8Array) => void) {
  let opened = false, accepting = false;
  let activation: Promise<boolean> | undefined;
  let unsubscribe: (() => void) | undefined;
  const close = async () => {
    if (!opened) return true;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (await bridge.audioControl(false).catch(() => false)) { opened = false; return true; }
    }
    return false;
  };
  return {
    async start() {
      accepting = true;
      unsubscribe?.();
      unsubscribe = bridge.onEvenHubEvent(event => {
        const audio = event.audioEvent;
        if (accepting && opened && audio?.source === AudioInputSource.Glasses
          && audio.audioPcm.length > 0 && audio.audioPcm.length <= 65_536) onPcm(audio.audioPcm);
      });
      const pending = Promise.resolve().then(() => bridge.audioControl(true, AudioInputSource.Glasses));
      activation = pending;
      try { opened = await pending; return opened && accepting; }
      finally { if (activation === pending) activation = undefined; }
    },
    async stop() {
      accepting = false; unsubscribe?.(); unsubscribe = undefined;
      await Promise.resolve();
      if (activation) opened = await activation.catch(() => false);
      const closed = await close(); opened = false; return closed;
    },
  };
}

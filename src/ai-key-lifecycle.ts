import type { AiRuntime } from "./ai-runtime";
import type { FastHudViewMode } from "./fast-hud-view";
type SessionOwner = Pick<AiRuntime, "start" | "stop">;
export function createAiKeyLifecycle(options: {
  readonly getKey: () => string | undefined;
  readonly getMode: () => FastHudViewMode;
  readonly ai: SessionOwner;
  readonly conversate: SessionOwner;
  readonly onError: () => void;
}) {
  let previous = options.getKey(), revision = 0, disposed = false;
  let stopping: Promise<boolean> = Promise.resolve(true);
  const activate = () => {
    if (disposed) return;
    const owner = options.getMode() === "ai" ? options.ai : options.getMode() === "conversate" ? options.conversate : undefined;
    void owner?.start().catch(options.onError);
  };
  return {
    ready: activate,
    changed() {
      const key = options.getKey();
      if (disposed || key === previous) return;
      previous = key;
      const owner = ++revision;
      const current = Promise.allSettled([options.ai.stop(), options.conversate.stop()]);
      const barrier = Promise.all([stopping, current]).then(([previous, results]) => previous && results.every(result => result.status === "fulfilled"));
      stopping = barrier;
      void barrier.then(ok => {
        if (disposed || owner !== revision || options.getKey() !== key) return;
        stopping = Promise.resolve(true);
        if (!ok) { options.onError(); return; }
        activate();
      });
    },
    dispose() { disposed = true; revision++; },
  };
}

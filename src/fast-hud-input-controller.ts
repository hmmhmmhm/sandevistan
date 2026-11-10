import type { AiRuntime } from "./ai-runtime";
import type { ConversateRuntime } from "./conversate-runtime";
import type {
  FastCanvasInput,
  FastCanvasInputResult,
} from "./fast-canvas-types";
import type { FastHudPage } from "./fast-hud-pages";
import {
  reduceFastHudInput,
  type FastHudViewContext,
  type FastHudViewState,
} from "./fast-hud-view";

type InteractiveLiveSession = {
  toggleTodo(index: number): Promise<boolean>;
  refreshNewsIfDue?(): void;
};

export function createFastHudInputController(options: {
  readonly getView: () => FastHudViewState;
  readonly setView: (view: FastHudViewState) => void;
  readonly getPage: () => FastHudPage;
  readonly getContext: () => FastHudViewContext;
  readonly getLiveSession: () => InteractiveLiveSession | undefined;
  readonly getAiRuntime: () => AiRuntime | undefined;
  readonly getConversateRuntime?: () => ConversateRuntime | undefined;
  readonly drawCurrentPage: () => void;
  readonly log?: (message: string) => void;
}) {
  return async (input: FastCanvasInput): Promise<FastCanvasInputResult> => {
    const previous = options.getView();
    if (input === "hold-start" || input === "hold-end") {
      if (previous.mode === "ai") {
        options.getAiRuntime()?.hold?.(input === "hold-start"); options.drawCurrentPage(); return "redraw";
      }
      return "consume";
    }
    const transition = reduceFastHudInput(
      previous,
      options.getPage(),
      input,
      options.getContext(),
    );
    options.setView(transition.state);
    options.log?.(
      `app ${input} · ${transition.result}`
        + (transition.effect ? ` · effect ${transition.effect.type}` : ""),
    );

    if (transition.effect?.type === "toggle-todo") {
      const changed = await options.getLiveSession()?.toggleTodo(
        transition.effect.index,
      ) ?? false;
      if (!changed) return "consume";
      options.drawCurrentPage();
      return "redraw";
    }

    const aiRuntime = options.getAiRuntime();
    const conversateRuntime = options.getConversateRuntime?.();
    if (transition.effect?.type === "tap-conversate") {
      conversateRuntime?.tap();
      options.drawCurrentPage();
      return "redraw";
    }
    if (transition.effect?.type === "scroll-conversate") {
      conversateRuntime?.scroll(transition.effect.delta);
      options.drawCurrentPage();
      return "redraw";
    }
    if (transition.effect?.type === "interrupt-ai") {
      await aiRuntime?.interrupt();
      options.drawCurrentPage();
      return "redraw";
    }
    if (transition.effect?.type === "start-ai") {
      void aiRuntime?.start();
    } else if (transition.effect?.type === "start-conversate") {
      void conversateRuntime?.start();
    } else if (transition.effect?.type === "stop-ai"
      || transition.effect?.type === "stop-conversate") {
      const stopping = transition.effect.type === "stop-ai" ? aiRuntime?.stop() : conversateRuntime?.stop();
      void stopping?.catch((error: unknown) => {
        options.log?.(`Conversation stop failed · ${error instanceof Error ? error.message : "unknown"}`);
      });
    }

    if (transition.result === "redraw" || transition.result === "hide" || transition.result === "exit") options.drawCurrentPage();
    if (previous.mode === "news" && transition.state.mode !== "news") {
      options.getLiveSession()?.refreshNewsIfDue?.();
    }
    return transition.result;
  };
}

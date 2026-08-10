import type { AiRuntime } from "./ai-runtime";
import type { ConversateRuntime } from "./conversate-runtime";
import type { NativeConversateContent } from "./native-conversate-text";
import type {
  FastCanvasInput,
  FastCanvasInputResult,
  FastCanvasNativeTextController,
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
  readonly getNativeText: () => FastCanvasNativeTextController | undefined;
  readonly nativeContent: () => string;
  readonly conversateContent?: () => NativeConversateContent;
  readonly drawCurrentPage: () => void;
  readonly log?: (message: string) => void;
}) {
  return async (input: FastCanvasInput): Promise<FastCanvasInputResult> => {
    const previous = options.getView();
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

    const nativeText = options.getNativeText();
    const aiRuntime = options.getAiRuntime();
    const conversateRuntime = options.getConversateRuntime?.();
    if (transition.effect?.type === "tap-conversate") {
      conversateRuntime?.tap();
      return "consume";
    }
    if (transition.effect?.type === "scroll-conversate") {
      conversateRuntime?.scroll(transition.effect.delta);
      return "consume";
    }
    if (transition.effect?.type === "interrupt-ai") {
      await aiRuntime?.interrupt();
      return "consume";
    }
    if (transition.effect?.type === "start-ai") {
      if (nativeText) {
        if (!aiRuntime || !await nativeText.enter(options.nativeContent())) {
          options.setView(previous);
          return "consume";
        }
        void aiRuntime.start();
        return "consume";
      }
      void aiRuntime?.start();
    } else if (transition.effect?.type === "start-conversate") {
      const content = options.conversateContent?.();
      if (!content || !nativeText?.enterConversate
        || !conversateRuntime
        || !await nativeText.enterConversate(content)) {
        options.setView(previous);
        return "consume";
      }
      void conversateRuntime.start();
      return "consume";
    } else if (transition.effect?.type === "stop-ai") {
      try {
        await aiRuntime?.stop();
      } catch (error) {
        options.log?.(
          `Ask AI stop failed · ${error instanceof Error ? error.message : "unknown"}`,
        );
      }
      if (nativeText?.active()) {
        options.drawCurrentPage();
        if (!await nativeText.restore()) options.setView(previous);
        return "consume";
      }
    } else if (transition.effect?.type === "stop-conversate") {
      await conversateRuntime?.stop();
      if (nativeText?.active()) {
        options.drawCurrentPage();
        if (!await nativeText.restore()) options.setView(previous);
        return "consume";
      }
    }

    if (
      transition.state.mode === "ai"
      && transition.result === "redraw"
      && nativeText?.active()
    ) {
      await nativeText.update(options.nativeContent());
      return "consume";
    }
    if (
      transition.state.mode === "conversate"
      && transition.result === "redraw"
      && nativeText?.active()
      && nativeText.updateConversate
      && options.conversateContent
    ) {
      await nativeText.updateConversate(options.conversateContent(), "input");
      return "consume";
    }
    if (transition.result === "redraw") options.drawCurrentPage();
    if (previous.mode === "news" && transition.state.mode !== "news") {
      options.getLiveSession()?.refreshNewsIfDue?.();
    }
    return transition.result;
  };
}

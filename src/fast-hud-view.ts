import type {
  FastCanvasInput,
  FastCanvasInputResult,
} from "./fast-canvas-transport";
import type { FastHudPage } from "./fast-hud-pages";

export const FAST_MAP_ZOOM_RADII = [850, 650, 500, 375, 280] as const;
export const FAST_MAP_DEFAULT_ZOOM_INDEX = 1;

export type FastHudViewMode =
  | "dashboard"
  | "map"
  | "news"
  | "x"
  | "todo"
  | "weather"
  | "ai"
  | "conversate"
  | "navigation";

export type FastHudViewState = {
  readonly mode: FastHudViewMode;
  readonly zoomIndex: number;
  readonly newsIndex: number;
  readonly newsPage: number;
  readonly todoIndex: number;
  readonly navigationIndex: number;
  readonly navigationFollowsActive: boolean;
  readonly aiLine: number;
  readonly aiFollowsLatest: boolean;
};

export type FastHudViewContext = {
  readonly newsCount: number;
  readonly newsPageCounts: readonly number[];
  readonly todoCount: number;
  readonly maneuverCount: number;
  readonly activeManeuverIndex: number;
  readonly aiLineCount?: number;
};

export type FastHudEffect =
  | { readonly type: "toggle-todo"; readonly index: number }
  | { readonly type: "start-ai" | "interrupt-ai" | "stop-ai" }
  | { readonly type: "start-conversate" | "tap-conversate" | "stop-conversate" }
  | { readonly type: "scroll-conversate"; readonly delta: -1 | 1 };

export type FastHudTransition = {
  readonly state: FastHudViewState;
  readonly result: FastCanvasInputResult;
  readonly effect?: FastHudEffect;
};

function clampIndex(index: number, count: number): number {
  const lastIndex = Math.max(0, Math.floor(count) - 1);
  return Math.min(Math.max(0, Math.floor(index)), lastIndex);
}

function clampZoom(index: number): number {
  return clampIndex(index, FAST_MAP_ZOOM_RADII.length);
}

function newsPageCount(
  context: FastHudViewContext,
  newsIndex: number,
): number {
  return Math.max(
    1,
    Math.floor(context.newsPageCounts[newsIndex] ?? 1),
  );
}

function pageMode(page: FastHudPage): Exclude<FastHudViewMode, "dashboard"> {
  return page === "overview" ? "map" : page;
}

function moveIndex(
  state: FastHudViewState,
  key: "newsIndex" | "todoIndex" | "navigationIndex" | "aiLine",
  input: FastCanvasInput,
  count: number,
  extra: Partial<FastHudViewState> = {},
): FastHudTransition {
  const delta = input === "scroll-next"
    ? 1
    : input === "scroll-previous"
      ? -1
      : 0;
  if (delta === 0 || count <= 0) {
    return { state, result: "consume" };
  }
  const nextIndex = clampIndex(state[key] + delta, count);
  if (nextIndex === state[key]) return { state, result: "consume" };
  return {
    state: { ...state, ...extra, [key]: nextIndex },
    result: "redraw",
  };
}

export function createFastHudViewState(): FastHudViewState {
  return {
    mode: "dashboard",
    zoomIndex: FAST_MAP_DEFAULT_ZOOM_INDEX,
    newsIndex: 0,
    newsPage: 0,
    todoIndex: 0,
    navigationIndex: 0,
    navigationFollowsActive: true,
    aiLine: 0,
    aiFollowsLatest: true,
  };
}

export function syncFastHudView(
  state: FastHudViewState,
  context: FastHudViewContext,
): FastHudViewState {
  const activeIndex = clampIndex(
    context.activeManeuverIndex,
    context.maneuverCount,
  );
  const newsIndex = clampIndex(state.newsIndex, context.newsCount);
  return {
    ...state,
    zoomIndex: clampZoom(state.zoomIndex),
    newsIndex,
    newsPage: clampIndex(
      state.newsPage,
      newsPageCount(context, newsIndex),
    ),
    todoIndex: clampIndex(state.todoIndex, context.todoCount),
    navigationIndex: state.navigationFollowsActive
      ? activeIndex
      : clampIndex(state.navigationIndex, context.maneuverCount),
    aiLine: state.aiFollowsLatest
      ? clampIndex((context.aiLineCount ?? 0) - 1, context.aiLineCount ?? 0)
      : clampIndex(state.aiLine, context.aiLineCount ?? 0),
  };
}

export function reduceFastHudInput(
  current: FastHudViewState,
  page: FastHudPage,
  input: FastCanvasInput,
  context: FastHudViewContext,
): FastHudTransition {
  if (current.mode === "dashboard") {
    if (input !== "tap") return { state: current, result: "unhandled" };
    const state = syncFastHudView(current, context);
    const mode = pageMode(page);
    return {
      state: mode === "navigation"
        ? {
            ...state,
            mode,
            navigationIndex: clampIndex(
              context.activeManeuverIndex,
              context.maneuverCount,
            ),
            navigationFollowsActive: true,
          }
        : mode === "ai"
          ? {
              ...state,
              mode,
              aiLine: clampIndex(
                (context.aiLineCount ?? 0) - 1,
                context.aiLineCount ?? 0,
              ),
              aiFollowsLatest: true,
            }
        : { ...state, mode },
      result: "redraw",
      effect: mode === "ai"
        ? { type: "start-ai" }
        : mode === "conversate"
          ? { type: "start-conversate" }
          : undefined,
    };
  }

  const state = current.mode === "map"
    ? { ...current, zoomIndex: clampZoom(current.zoomIndex) }
    : current.mode === "news" || current.mode === "x"
      ? {
          ...current,
          newsIndex: clampIndex(current.newsIndex, context.newsCount),
          newsPage: clampIndex(
            current.newsPage,
            newsPageCount(
              context,
              clampIndex(current.newsIndex, context.newsCount),
            ),
          ),
        }
      : current.mode === "todo"
        ? {
            ...current,
            todoIndex: clampIndex(current.todoIndex, context.todoCount),
          }
        : current.mode === "weather" || current.mode === "ai" || current.mode === "conversate"
          ? current
          : {
              ...current,
              navigationIndex: current.navigationFollowsActive
                ? clampIndex(
                    context.activeManeuverIndex,
                    context.maneuverCount,
                  )
                : clampIndex(
                    current.navigationIndex,
                    context.maneuverCount,
                  ),
            };

  if (input === "double-tap") {
    return {
      state: { ...state, mode: "dashboard" },
      result: "redraw",
      effect: state.mode === "ai"
        ? { type: "stop-ai" }
        : state.mode === "conversate"
          ? { type: "stop-conversate" }
          : undefined,
    };
  }

  if (state.mode === "map") {
    if (input !== "scroll-next" && input !== "scroll-previous") {
      return { state, result: "consume" };
    }
    const delta = input === "scroll-next" ? -1 : 1;
    const zoomIndex = clampZoom(state.zoomIndex + delta);
    return zoomIndex === state.zoomIndex
      ? { state, result: "consume" }
      : { state: { ...state, zoomIndex }, result: "redraw" };
  }

  if (state.mode === "news" || state.mode === "x") {
    if (input !== "scroll-next" && input !== "scroll-previous") {
      return { state, result: "consume" };
    }
    if (context.newsCount <= 0) return { state, result: "consume" };
    if (input === "scroll-next") {
      const pages = newsPageCount(context, state.newsIndex);
      if (state.newsPage < pages - 1) {
        return {
          state: { ...state, newsPage: state.newsPage + 1 },
          result: "redraw",
        };
      }
      if (state.newsIndex >= context.newsCount - 1) {
        return { state, result: "consume" };
      }
      return {
        state: {
          ...state,
          newsIndex: state.newsIndex + 1,
          newsPage: 0,
        },
        result: "redraw",
      };
    }
    if (state.newsPage > 0) {
      return {
        state: { ...state, newsPage: state.newsPage - 1 },
        result: "redraw",
      };
    }
    if (state.newsIndex <= 0) return { state, result: "consume" };
    const newsIndex = state.newsIndex - 1;
    return {
      state: {
        ...state,
        newsIndex,
        newsPage: newsPageCount(context, newsIndex) - 1,
      },
      result: "redraw",
    };
  }

  if (state.mode === "weather") {
    return { state, result: "consume" };
  }

  if (state.mode === "ai") {
    if (input === "tap") {
      return {
        state: {
          ...state,
          aiLine: clampIndex(
            (context.aiLineCount ?? 0) - 1,
            context.aiLineCount ?? 0,
          ),
          aiFollowsLatest: true,
        },
        result: "consume",
        effect: { type: "interrupt-ai" },
      };
    }
    if (input !== "scroll-next" && input !== "scroll-previous") {
      return { state, result: "consume" };
    }
    const count = context.aiLineCount ?? 0;
    if (count <= 0) return { state, result: "consume" };
    const delta = input === "scroll-next" ? 1 : -1;
    const aiLine = clampIndex(state.aiLine + delta, count);
    const aiFollowsLatest = aiLine === count - 1;
    if (
      aiLine === state.aiLine
      && aiFollowsLatest === state.aiFollowsLatest
    ) {
      return { state, result: "consume" };
    }
    return {
      state: { ...state, aiLine, aiFollowsLatest },
      result: "redraw",
    };
  }

  if (state.mode === "conversate") {
    if (input === "tap") {
      return { state, result: "consume", effect: { type: "tap-conversate" } };
    }
    if (input === "scroll-next" || input === "scroll-previous") {
      return {
        state,
        result: "consume",
        effect: {
          type: "scroll-conversate",
          delta: input === "scroll-next" ? 1 : -1,
        },
      };
    }
    return { state, result: "consume" };
  }

  if (state.mode === "todo") {
    if (input === "tap") {
      return context.todoCount <= 0
        ? { state, result: "consume" }
        : {
            state,
            result: "consume",
            effect: { type: "toggle-todo", index: state.todoIndex },
          };
    }
    return moveIndex(
      state,
      "todoIndex",
      input,
      context.todoCount,
    );
  }

  if (input === "tap") {
    if (context.maneuverCount <= 0) {
      return { state, result: "consume" };
    }
    const navigationIndex = clampIndex(
      context.activeManeuverIndex,
      context.maneuverCount,
    );
    if (
      navigationIndex === state.navigationIndex
      && state.navigationFollowsActive
    ) {
      return { state, result: "consume" };
    }
    return {
      state: {
        ...state,
        navigationIndex,
        navigationFollowsActive: true,
      },
      result: "redraw",
    };
  }
  return moveIndex(
    state,
    "navigationIndex",
    input,
    context.maneuverCount,
    { navigationFollowsActive: false },
  );
}

import { describe, expect, it } from "vitest";
import {
  FAST_MAP_DEFAULT_ZOOM_INDEX,
  FAST_MAP_ZOOM_RADII,
  createFastHudViewState,
  reduceFastHudInput,
  syncFastHudView,
  type FastHudViewContext,
  type FastHudViewState,
} from "./fast-hud-view";

const CONTEXT: FastHudViewContext = {
  newsCount: 6,
  newsPageCounts: [2, 3, 1, 1, 1, 1],
  todoCount: 3,
  maneuverCount: 4,
  activeManeuverIndex: 1,
};

describe("fast HUD detail state", () => {
  it("enters the detail deck assigned to every dashboard page", () => {
    const initial = createFastHudViewState();

    expect(reduceFastHudInput(initial, "overview", "tap", CONTEXT).state.mode)
      .toBe("map");
    expect(reduceFastHudInput(initial, "news", "tap", CONTEXT).state.mode)
      .toBe("news");
    expect(reduceFastHudInput(initial, "todo", "tap", CONTEXT).state.mode)
      .toBe("todo");
    expect(reduceFastHudInput(initial, "weather", "tap", CONTEXT).state.mode)
      .toBe("weather");
    expect(reduceFastHudInput(initial, "ai", "tap", CONTEXT)).toMatchObject({
      state: { mode: "ai" },
      effect: { type: "start-ai" },
    });
    expect(
      reduceFastHudInput(initial, "navigation", "tap", CONTEXT).state,
    ).toMatchObject({
      mode: "navigation",
      navigationIndex: 1,
      navigationFollowsActive: true,
    });
  });

  it("leaves dashboard page scrolling unhandled", () => {
    const state = createFastHudViewState();

    for (const input of [
      "scroll-next",
      "scroll-previous",
    ] as const) {
      expect(reduceFastHudInput(state, "overview", input, CONTEXT)).toEqual({
        state,
        result: "unhandled",
      });
    }
  });

  it("zooms out on next, in on previous, and consumes zoom boundaries", () => {
    let state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "map",
    };

    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(650);
    state = reduceFastHudInput(
      state,
      "overview",
      "scroll-next",
      CONTEXT,
    ).state;
    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(850);
    state = reduceFastHudInput(
      { ...state, zoomIndex: FAST_MAP_DEFAULT_ZOOM_INDEX },
      "overview",
      "scroll-previous",
      CONTEXT,
    ).state;
    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(500);
    expect(reduceFastHudInput(
      { ...state, zoomIndex: 0 },
      "overview",
      "scroll-next",
      CONTEXT,
    ).result).toBe("consume");
    expect(reduceFastHudInput(
      { ...state, zoomIndex: FAST_MAP_ZOOM_RADII.length - 1 },
      "overview",
      "scroll-previous",
      CONTEXT,
    ).result).toBe("consume");
  });

  it("moves through body pages before crossing article boundaries", () => {
    const state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "news",
      newsIndex: 0,
      newsPage: 0,
    };

    const nextPage = reduceFastHudInput(
      state,
      "news",
      "scroll-next",
      CONTEXT,
    );
    expect(nextPage).toMatchObject({
      state: { newsIndex: 0, newsPage: 1 },
      result: "redraw",
    });
    expect(reduceFastHudInput(
      nextPage.state,
      "news",
      "scroll-next",
      CONTEXT,
    )).toMatchObject({
      state: { newsIndex: 1, newsPage: 0 },
      result: "redraw",
    });
    expect(reduceFastHudInput(
      { ...state, newsIndex: 1, newsPage: 0 },
      "news",
      "scroll-previous",
      CONTEXT,
    )).toMatchObject({
      state: { newsIndex: 0, newsPage: 1 },
      result: "redraw",
    });
    expect(reduceFastHudInput(state, "news", "tap", CONTEXT)).toEqual({
      state,
      result: "consume",
    });
    expect(reduceFastHudInput(
      { ...state, newsIndex: 5, newsPage: 0 },
      "news",
      "scroll-next",
      CONTEXT,
    ).result).toBe("consume");
    expect(reduceFastHudInput(
      state,
      "news",
      "scroll-previous",
      CONTEXT,
    ).result).toBe("consume");
  });

  it("selects and toggles TODO items without changing the state first", () => {
    const state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "todo",
      todoIndex: 0,
    };
    const selected = reduceFastHudInput(
      state,
      "todo",
      "scroll-next",
      CONTEXT,
    ).state;

    expect(selected.todoIndex).toBe(1);
    expect(reduceFastHudInput(selected, "todo", "tap", CONTEXT)).toEqual({
      state: selected,
      result: "consume",
      effect: { type: "toggle-todo", index: 1 },
    });
    expect(reduceFastHudInput(
      { ...state, todoIndex: 2 },
      "todo",
      "scroll-next",
      CONTEXT,
    ).result).toBe("consume");
  });

  it("browses route steps, then returns to the active step on tap", () => {
    const state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "navigation",
      navigationIndex: 1,
      navigationFollowsActive: true,
    };
    const browsed = reduceFastHudInput(
      state,
      "navigation",
      "scroll-next",
      CONTEXT,
    );

    expect(browsed).toMatchObject({
      state: {
      navigationIndex: 2,
      navigationFollowsActive: false,
      aiLine: 0,
      },
      result: "redraw",
    });
    expect(reduceFastHudInput(
      browsed.state,
      "navigation",
      "tap",
      CONTEXT,
    )).toMatchObject({
      state: {
        navigationIndex: 1,
        navigationFollowsActive: true,
      },
      result: "redraw",
    });
  });

  it("consumes weather detail gestures and returns on double tap", () => {
    const state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "weather",
    };

    for (const input of [
      "tap",
      "scroll-next",
      "scroll-previous",
    ] as const) {
      expect(reduceFastHudInput(state, "weather", input, CONTEXT)).toEqual({
        state,
        result: "consume",
      });
    }
    expect(reduceFastHudInput(
      state,
      "weather",
      "double-tap",
      CONTEXT,
    )).toMatchObject({
      state: { mode: "dashboard" },
      result: "redraw",
    });
  });

  it("enters Ask AI at the newest line and follows newly streamed lines", () => {
    const entered = reduceFastHudInput(
      createFastHudViewState(),
      "ai",
      "tap",
      { ...CONTEXT, aiLineCount: 3 },
    ).state;

    expect(entered).toMatchObject({
      mode: "ai",
      aiLine: 2,
      aiFollowsLatest: true,
    });
    expect(syncFastHudView(
      entered,
      { ...CONTEXT, aiLineCount: 5 },
    )).toMatchObject({
      aiLine: 4,
      aiFollowsLatest: true,
    });
  });

  it("moves Ask AI history exactly one line and pins it until newest", () => {
    const live: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "ai",
      aiLine: 4,
      aiFollowsLatest: true,
    };
    const history = reduceFastHudInput(
      live,
      "ai",
      "scroll-previous",
      { ...CONTEXT, aiLineCount: 5 },
    ).state;

    expect(history).toMatchObject({
      aiLine: 3,
      aiFollowsLatest: false,
    });
    expect(syncFastHudView(
      history,
      { ...CONTEXT, aiLineCount: 6 },
    )).toMatchObject({
      aiLine: 3,
      aiFollowsLatest: false,
    });

    const newer = reduceFastHudInput(
      history,
      "ai",
      "scroll-next",
      { ...CONTEXT, aiLineCount: 5 },
    ).state;
    expect(newer).toMatchObject({
      aiLine: 4,
      aiFollowsLatest: true,
    });
  });

  it("routes a single Ask AI tap to response interruption", () => {
    const state: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "ai",
      aiLine: 0,
      aiFollowsLatest: false,
    };

    expect(reduceFastHudInput(
      state,
      "ai",
      "tap",
      { ...CONTEXT, aiLineCount: 3 },
    )).toEqual({
      state: {
        ...state,
        aiLine: 2,
        aiFollowsLatest: true,
      },
      result: "consume",
      effect: { type: "interrupt-ai" },
    });
  });

  it("returns from every detail deck on double tap and retains indices", () => {
    for (const mode of [
      "map",
      "news",
      "todo",
      "weather",
      "navigation",
    ] as const) {
      const state: FastHudViewState = {
        ...createFastHudViewState(),
        mode,
        zoomIndex: 3,
        newsIndex: 2,
        newsPage: 1,
        todoIndex: 1,
        navigationIndex: 2,
        navigationFollowsActive: false,
      };

      expect(reduceFastHudInput(
        state,
        "overview",
        "double-tap",
        CONTEXT,
      )).toEqual({
        state: {
          ...state,
          mode: "dashboard",
          newsPage: mode === "news" ? 0 : state.newsPage,
        },
        result: "redraw",
      });
    }
  });

  it("clamps selections and follows active route changes", () => {
    const state: FastHudViewState = {
      mode: "navigation",
      menuIndex: 2,
      zoomIndex: 99,
      newsIndex: 5,
      newsPage: 99,
      todoIndex: 2,
      navigationIndex: 3,
      navigationFollowsActive: true,
      aiLine: 0,
      aiFollowsLatest: true,
    };

    expect(syncFastHudView(state, {
      newsCount: 2,
      newsPageCounts: [2, 3],
      todoCount: 1,
      maneuverCount: 3,
      activeManeuverIndex: 2,
    })).toEqual({
      mode: "navigation",
      menuIndex: 2,
      zoomIndex: FAST_MAP_ZOOM_RADII.length - 1,
      newsIndex: 1,
      newsPage: 2,
      todoIndex: 0,
      navigationIndex: 2,
      navigationFollowsActive: true,
      aiLine: 0,
      aiFollowsLatest: true,
    });
    expect(createFastHudViewState().zoomIndex)
      .toBe(FAST_MAP_DEFAULT_ZOOM_INDEX);
  });
});

it("opens the approved menu on root double tap and separates hide from system exit", () => {
 const initial = createFastHudViewState();
 const menu = reduceFastHudInput(initial,"overview","double-tap",CONTEXT);
 expect(menu).toMatchObject({state:{mode:"quick-menu",menuIndex:2},result:"redraw"});
 expect(reduceFastHudInput(menu.state,"overview","tap",CONTEXT)).toMatchObject({state:{mode:"dashboard"},result:"redraw"});
 const exit = reduceFastHudInput(menu.state,"overview","scroll-previous",CONTEXT);
 expect(reduceFastHudInput(exit.state,"overview","tap",CONTEXT)).toMatchObject({state:{mode:"dashboard"},result:"exit"});
 const hide = reduceFastHudInput(exit.state,"overview","scroll-previous",CONTEXT);
 expect(reduceFastHudInput(hide.state,"overview","tap",CONTEXT)).toMatchObject({state:{mode:"dashboard"},result:"hide"});
 expect(reduceFastHudInput(menu.state,"overview","double-tap",CONTEXT)).toMatchObject({state:{mode:"dashboard"},result:"redraw"});
});

import { describe, expect, it, vi } from "vitest";
import { createFastHudInputController } from "./fast-hud-input-controller";
import {
  createFastHudViewState,
  type FastHudViewState,
} from "./fast-hud-view";

describe("fast HUD native Ask AI input flow", () => {
  it("loads the next X page when scrolling past the final loaded post", async () => {
    let view: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "x",
      newsIndex: 1,
    };
    const loadMoreX = vi.fn(async () => true);
    const draw = vi.fn();
    const input = createFastHudInputController({
      getView: () => view,
      setView: (next) => { view = next; },
      getPage: () => "x",
      getContext: () => ({
        newsCount: 2,
        newsPageCounts: [1, 1],
        todoCount: 0,
        maneuverCount: 0,
        activeManeuverIndex: 0,
      }),
      getLiveSession: () => undefined,
      getAiRuntime: () => undefined,
      getNativeText: () => undefined,
      nativeContent: () => "",
      drawCurrentPage: draw,
      loadMoreX,
    });

    await expect(input("scroll-next")).resolves.toBe("redraw");
    expect(loadMoreX).toHaveBeenCalledOnce();
    expect(draw).toHaveBeenCalledOnce();
  });

  it("enters one native page, updates it for history, and restores Canvas", async () => {
    let view = createFastHudViewState();
    let nativeActive = false;
    const native = {
      active: vi.fn(() => nativeActive),
      enter: vi.fn(async () => {
        nativeActive = true;
        return true;
      }),
      update: vi.fn(async () => true),
      restore: vi.fn(async () => {
        nativeActive = false;
        return true;
      }),
    };
    const ai = {
      start: vi.fn(async () => true),
      interrupt: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    const draw = vi.fn();
    const input = createFastHudInputController({
      getView: () => view,
      setView: (next) => { view = next; },
      getPage: () => "ai",
      getContext: () => ({
        newsCount: 0,
        newsPageCounts: [],
        todoCount: 0,
        maneuverCount: 0,
        activeManeuverIndex: 0,
        aiLineCount: 2,
      }),
      getLiveSession: () => undefined,
      getAiRuntime: () => ai,
      getNativeText: () => native,
      nativeContent: () => `LINE ${view.aiLine}`,
      drawCurrentPage: draw,
    });

    expect(await input("tap")).toBe("consume");
    expect(view.mode).toBe("ai");
    expect(native.enter).toHaveBeenCalledWith("LINE 1");
    expect(ai.start).toHaveBeenCalledOnce();
    expect(draw).not.toHaveBeenCalled();

    expect(await input("scroll-previous")).toBe("consume");
    expect(view.aiLine).toBe(0);
    expect(native.update).toHaveBeenCalledWith("LINE 0");

    native.update.mockClear();
    expect(await input("tap")).toBe("consume");
    expect(native.update).not.toHaveBeenCalled();
    expect(ai.interrupt).toHaveBeenCalledOnce();
    expect(ai.stop).not.toHaveBeenCalled();

    expect(await input("double-tap")).toBe("consume");
    expect(view.mode).toBe("dashboard");
    expect(ai.stop).toHaveBeenCalledOnce();
    expect(draw).toHaveBeenCalledOnce();
    expect(native.restore).toHaveBeenCalledOnce();
  });

  it("does not start the microphone when the native page cannot open", async () => {
    let view = createFastHudViewState();
    const start = vi.fn(async () => true);
    const input = createFastHudInputController({
      getView: () => view,
      setView: (next) => { view = next; },
      getPage: () => "ai",
      getContext: () => ({
        newsCount: 0,
        newsPageCounts: [],
        todoCount: 0,
        maneuverCount: 0,
        activeManeuverIndex: 0,
        aiLineCount: 1,
      }),
      getLiveSession: () => undefined,
      getAiRuntime: () => ({
        start,
        interrupt: async () => undefined,
        stop: async () => undefined,
        dispose: () => undefined,
      }),
      getNativeText: () => ({
        active: () => false,
        enter: async () => false,
        update: async () => false,
        restore: async () => false,
      }),
      nativeContent: () => "ASK AI",
      drawCurrentPage: () => undefined,
    });

    expect(await input("tap")).toBe("consume");
    expect(view.mode).toBe("dashboard");
    expect(start).not.toHaveBeenCalled();
  });

  it("restores Canvas even when stopping Ask AI rejects unexpectedly", async () => {
    let view: FastHudViewState = {
      ...createFastHudViewState(),
      mode: "ai",
    };
    const restore = vi.fn(async () => true);
    const draw = vi.fn();
    const input = createFastHudInputController({
      getView: () => view,
      setView: (next) => { view = next; },
      getPage: () => "ai",
      getContext: () => ({
        newsCount: 0,
        newsPageCounts: [],
        todoCount: 0,
        maneuverCount: 0,
        activeManeuverIndex: 0,
      }),
      getLiveSession: () => undefined,
      getAiRuntime: () => ({
        start: async () => true,
        interrupt: async () => undefined,
        stop: async () => { throw new Error("storage unavailable"); },
        dispose: () => undefined,
      }),
      getNativeText: () => ({
        active: () => true,
        enter: async () => true,
        update: async () => true,
        restore,
      }),
      nativeContent: () => "ASK AI",
      drawCurrentPage: draw,
    });

    await expect(input("double-tap")).resolves.toBe("consume");
    expect(view.mode).toBe("dashboard");
    expect(draw).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledOnce();
  });
});

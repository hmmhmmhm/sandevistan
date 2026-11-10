import { expect, it, vi } from "vitest";
import { createFastHudInputController } from "./fast-hud-input-controller";
import { createFastHudViewState } from "./fast-hud-view";

function harness(page: "ai" | "conversate") {
  let view = createFastHudViewState();
  const ai = { start: vi.fn(async () => true), stop: vi.fn(async () => undefined), interrupt: vi.fn(async () => undefined), dispose: vi.fn() };
  const conversate = { start: vi.fn(async () => true), stop: vi.fn(async () => undefined), tap: vi.fn(), scroll: vi.fn(), dispose: vi.fn() };
  const draw = vi.fn();
  const native = { active: () => false, enter: vi.fn(async () => true), update: vi.fn(async () => true), restore: vi.fn(async () => true) };
  const input = createFastHudInputController({
    getView: () => view, setView: (next) => { view = next; }, getPage: () => page,
    getContext: () => ({ newsCount: 0, newsPageCounts: [], todoCount: 0, maneuverCount: 0, activeManeuverIndex: 0, aiLineCount: 2 }),
    getLiveSession: () => undefined, getAiRuntime: () => ai, getConversateRuntime: () => conversate,
    drawCurrentPage: draw,
  });
  return { input, ai, conversate, native, draw, view: () => view };
}
it("keeps Ask AI on the image page across entry, history, flush and exit", async () => {
  const h = harness("ai");
  expect(await h.input("tap")).toBe("redraw");
  expect(h.ai.start).toHaveBeenCalledOnce();
  expect(h.native.enter).not.toHaveBeenCalled();
  expect(await h.input("scroll-previous")).toBe("redraw");
  expect(h.view().aiLine).toBe(0);
  expect(await h.input("tap")).toBe("redraw");
  expect(h.ai.interrupt).toHaveBeenCalledOnce();
  expect(await h.input("double-tap")).toBe("redraw");
  expect(h.ai.stop).toHaveBeenCalledOnce();
  expect(h.view().mode).toBe("dashboard");
  expect(h.native.restore).not.toHaveBeenCalled();
});
it("renders Conversate input changes through images and exits after a storage error", async () => {
  const h = harness("conversate");
  expect(await h.input("tap")).toBe("redraw");
  expect(h.conversate.start).toHaveBeenCalledOnce();
  expect(await h.input("tap")).toBe("redraw");
  expect(h.conversate.tap).toHaveBeenCalledOnce();
  expect(await h.input("scroll-next")).toBe("redraw");
  expect(h.conversate.scroll).toHaveBeenCalledOnce();
  h.conversate.stop.mockRejectedValueOnce(new Error("storage unavailable"));
  expect(await h.input("double-tap")).toBe("redraw");
  expect(h.view().mode).toBe("dashboard");
});

it("returns to the dashboard without waiting for microphone or storage acknowledgements", async () => {
  const h = harness("ai");
  await h.input("tap");
  let finish: (() => void) | undefined;
  h.ai.stop.mockImplementationOnce(() => new Promise<undefined>(resolve => { finish = () => resolve(undefined); }));
  let returned = false;
  const exit = h.input("double-tap").then(() => { returned = true; });
  await Promise.resolve(); await Promise.resolve();
  expect(h.view().mode).toBe("dashboard");
  expect(returned).toBe(true);
  finish?.(); await exit;
});

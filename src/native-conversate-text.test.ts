import { describe, expect, it, vi } from "vitest";
import { RebuildPageContainer } from "@evenrealities/even_hub_sdk";
import { createConversateSnapshot, DEFAULT_CONVERSATE_SETTINGS } from "./conversate-state";
import { createNativeConversateContent, createNativeConversateMode } from "./native-conversate-text";

describe("native Conversate text page", () => {
  it("uses the hardware-proven single event-capturing text page", async () => {
    const pages: RebuildPageContainer[] = [];
    const rebuildPageContainer = vi.fn(async (page: RebuildPageContainer) => {
      pages.push(page);
      return true;
    });
    const mode = createNativeConversateMode({
      bridge: { rebuildPageContainer, textContainerUpgrade: vi.fn(async () => true) },
      createImagePage: () => new RebuildPageContainer({ containerTotalNum: 0 }),
    });
    await mode.enter({ inform: "Correction", body: "Live transcript" });
    const page = pages[0];
    expect(page).toBeDefined();
    if (!page) return;
    expect(page.containerTotalNum).toBe(1);
    expect(page.textObject).toEqual([
      expect.objectContaining({
        containerName: "conversateText",
        width: 576,
        height: 288,
        isEventCapture: 1,
        content: "Correction\n\nLive transcript",
      }),
    ]);
  });

  it("uses SDK-safe blank text when entering or clearing an empty region", async () => {
    const upgrades: unknown[] = [];
    const rebuildPageContainer = vi.fn(async (_page: RebuildPageContainer) => true);
    const mode = createNativeConversateMode({
      bridge: {
        rebuildPageContainer,
        textContainerUpgrade: vi.fn(async (update) => { upgrades.push(update); return true; }),
      },
      createImagePage: () => new RebuildPageContainer({ containerTotalNum: 0 }),
    });
    await mode.enter({ inform: "", body: "" });
    expect(rebuildPageContainer.mock.calls[0]?.[0].textObject).toEqual([
      expect.objectContaining({ containerName: "conversateText", content: " " }),
    ]);
    await mode.update({ inform: "Correction", body: "Transcript" });
    await mode.update({ inform: "", body: "" });
    expect(upgrades.at(-1)).toEqual(
      expect.objectContaining({ containerName: "conversateText", content: " " }),
    );
  });

  it("sends the newest correction immediately after an in-flight update", async () => {
    let releaseFirst: ((value: boolean) => void) | undefined;
    const first = new Promise<boolean>((resolve) => { releaseFirst = resolve; });
    const textContainerUpgrade = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(true);
    const mode = createNativeConversateMode({
      bridge: {
        rebuildPageContainer: vi.fn(async () => true),
        textContainerUpgrade,
      },
      createImagePage: () => new RebuildPageContainer({ containerTotalNum: 0 }),
    });
    await mode.enter({ inform: "", body: "Initial" });
    const updating = mode.update({ inform: "", body: "Rough transcript" });
    expect(await mode.update({ inform: "", body: "Corrected transcript" })).toBe(true);
    releaseFirst?.(true);
    expect(await updating).toBe(true);
    expect(textContainerUpgrade.mock.calls.map(([update]) => update.content)).toEqual([
      "Rough transcript",
      "Corrected transcript",
    ]);
  });

  it("coalesces noisy updates while preserving input and the newest transcript", async () => {
    let releaseFirst: ((value: boolean) => void) | undefined;
    let clock = 1_000;
    const waits: number[] = [];
    const first = new Promise<boolean>((resolve) => { releaseFirst = resolve; });
    const textContainerUpgrade = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(true);
    const mode = createNativeConversateMode({
      bridge: {
        rebuildPageContainer: vi.fn(async () => true),
        textContainerUpgrade,
      },
      createImagePage: () => new RebuildPageContainer({ containerTotalNum: 0 }),
      now: () => clock,
      wait: async (milliseconds) => {
        waits.push(milliseconds);
        clock += milliseconds;
      },
    });
    await mode.enter({ inform: "", body: "Initial" });
    const updating = mode.update({ inform: "", body: "Rough" }, "transcript");
    await mode.update({ inform: "Old fact", body: "Rough" }, "analysis");
    await mode.update({ inform: "", body: "User selection" }, "input");
    await mode.update({ inform: "", body: "Corrected" }, "transcript");
    releaseFirst?.(true);

    expect(await updating).toBe(true);
    expect(textContainerUpgrade.mock.calls.map(([update]) => update.content)).toEqual([
      "Rough",
      "User selection",
      "Corrected",
    ]);
    expect(waits).toEqual([120]);
  });

  it("keeps transcription primary while honoring the translation toggle", () => {
    const snapshot = {
      ...createConversateSnapshot(),
      segments: [{ id: "one", text: "Hello", translation: "안녕하세요", at: new Date().toISOString() }],
    };
    expect(createNativeConversateContent(snapshot, "ko", {
      ...DEFAULT_CONVERSATE_SETTINGS, transcription: false,
    }).body).toContain("Hello");
    expect(createNativeConversateContent(snapshot, "ko", {
      ...DEFAULT_CONVERSATE_SETTINGS, translation: false,
    }).body).not.toContain("안녕하세요");
  });

  it("keeps the selected transcript visible with translation and compact Copilot", () => {
    const snapshot = {
      ...createConversateSnapshot(),
      segments: [
        { id: "old", text: "Earlier topic", translation: "이전 주제", at: "1" },
        { id: "new", text: "Latest speech", translation: "최신 발화", at: "2" },
      ],
      suggestions: [{
        style: "direct", original: "I agree", pronunciation: "아이 어그리", meaning: "동의합니다",
      }],
    };
    const latest = createNativeConversateContent(snapshot, "ko", DEFAULT_CONVERSATE_SETTINGS);
    expect(latest.body).toContain("Latest speech\n→ 최신 발화");
    expect(latest.body).toContain("· 1/1 direct · I agree");
    const previous = createNativeConversateContent(
      { ...snapshot, transcriptOffset: 1 },
      "ko",
      DEFAULT_CONVERSATE_SETTINGS,
    );
    expect(previous.body).toContain("Earlier topic\n→ 이전 주제");
    expect(previous.body).not.toContain("Latest speech");
  });

  it("shows Inform history without replacing the transcript", () => {
    const snapshot = {
      ...createConversateSnapshot(),
      segments: [{ id: "new", text: "Still transcribing", at: "1" }],
      informs: [{ id: "info", text: "Useful context", at: "1" }],
      informHistoryOpen: true,
    };
    const content = createNativeConversateContent(snapshot, "en", DEFAULT_CONVERSATE_SETTINGS);
    expect(content.inform).toContain("Useful context");
    expect(content.body).toContain("Still transcribing");
  });
});

import { describe, expect, it, vi } from "vitest";
import { EMPTY_AI_USAGE } from "./ai-cost";
import { resolveAiConversationHistory } from "./ai-history";
import { createAiHudSnapshot } from "./ai-hud-state";
import { createRealtimeProtocolState } from "./ai-realtime-protocol";
import { createAiRuntime } from "./ai-runtime";
import type { EvenStorage } from "./live-cache";
import { writeMcpServers } from "./mcp-servers";
import { priceRealtimeUsage } from "./ai-pricing";

class TestBridge implements EvenStorage {
  readonly values = new Map<string, string>();
  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
  async audioControl() { return true; }
  onEvenHubEvent() { return vi.fn(); }
}

describe("Ask AI runtime", () => {
  it("starts only with BYOK and persists one local excerpt and usage on exit", async () => {
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(true);
    const usage = {
      ...EMPTY_AI_USAGE,
      audioInputTokens: 100,
      textOutputTokens: 20,
    };
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "listening" as const,
      userText: "오늘 일정을 알려줘",
      assistantText: "오후 세 시에 검토 일정이 있습니다.",
      usage,
      charge: priceRealtimeUsage({
        model: "gpt-realtime",
        textInputTokens: usage.textInputTokens,
        cachedTextInputTokens: usage.cachedTextInputTokens,
        audioInputTokens: usage.audioInputTokens,
        cachedAudioInputTokens: usage.cachedAudioInputTokens,
        textOutputTokens: usage.textOutputTokens,
      }),
    };
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => protocol);
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh: vi.fn(),
      createSession: vi.fn(() => ({
        start,
        cancelResponse: vi.fn(() => protocol),
        stop,
        getState: () => protocol,
      })),
    });

    await expect(runtime.start()).resolves.toBe(true);
    expect(start).toHaveBeenCalledOnce();
    await runtime.stop();

    expect(stop).toHaveBeenCalledOnce();
    await expect(resolveAiConversationHistory(bridge)).resolves.toEqual([
      expect.objectContaining({
        user: "오늘 일정을 알려줘",
        assistant: "오후 세 시에 검토 일정이 있습니다.",
      }),
    ]);
    expect(snapshot.history).toHaveLength(1);
    expect(snapshot.weekUsd).toBeGreaterThan(0);
    expect(snapshot.monthUsd).toBe(snapshot.weekUsd);
  });

  it("does not create a session when no key is configured", async () => {
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(false);
    const createSession = vi.fn();
    const runtime = createAiRuntime({
      bridge,
      getKey: () => undefined,
      getLocale: () => "en",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh: vi.fn(),
      createSession,
    });

    await expect(runtime.start()).resolves.toBe(false);
    expect(createSession).not.toHaveBeenCalled();
    expect(snapshot).toMatchObject({
      configured: false,
      phase: "unconfigured",
    });
  });

  it("persists the latest non-empty turn before a delayed placeholder", async () => {
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(true);
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "listening" as const,
      turns: [{
        user: "완료된 질문",
        assistant: "완료된 답변",
      }, {
        user: "",
        assistant: "",
      }],
    };
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh: vi.fn(),
      createSession: vi.fn(() => ({
        start: vi.fn(async () => undefined),
        cancelResponse: vi.fn(() => protocol),
        stop: vi.fn(async () => protocol),
        getState: () => protocol,
      })),
    });

    await runtime.start();
    await runtime.stop();

    await expect(resolveAiConversationHistory(bridge)).resolves.toEqual([
      expect.objectContaining({
        user: "완료된 질문",
        assistant: "완료된 답변",
      }),
    ]);
  });

  it("presents response.done as the next received-text batch", async () => {
    vi.useFakeTimers();
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(true);
    let onState: ((
      state: ReturnType<typeof createRealtimeProtocolState>,
      eventType?: string,
    ) => void) | undefined;
    const refresh = vi.fn(async () => undefined);
    const protocol = createRealtimeProtocolState();
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh,
      createSession: vi.fn((options) => {
        onState = options.onState;
        return {
          start: vi.fn(async () => undefined),
          cancelResponse: vi.fn(() => protocol),
          stop: vi.fn(async () => protocol),
          getState: () => protocol,
        };
      }),
    });

    await runtime.start();
    onState?.({
      ...protocol,
      phase: "thinking",
      assistantText: "첫",
    }, "response.output_text.delta");
    await vi.advanceTimersByTimeAsync(199);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledOnce();
    expect(snapshot.assistantText).toBe("첫");

    onState?.({
      ...protocol,
      phase: "listening",
      assistantText: "첫 답변",
    }, "response.done");
    expect(refresh).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(600);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(snapshot.assistantText).toBe("첫 답변");

    runtime.dispose();
    vi.useRealTimers();
  });

  it("coalesces new text while a batch is in flight", async () => {
    vi.useFakeTimers();
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(true);
    let onState: ((state: ReturnType<typeof createRealtimeProtocolState>) => void)
      | undefined;
    let release: (() => void) | undefined;
    const transmitted: string[] = [];
    const refresh = vi.fn(() => {
      const content = snapshot.assistantText;
      return new Promise<void>((resolve) => {
        release = () => {
          transmitted.push(content);
          resolve();
        };
      });
    });
    const protocol = createRealtimeProtocolState();
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh,
      createSession: vi.fn((options) => {
        onState = options.onState;
        return {
          start: vi.fn(async () => undefined),
          cancelResponse: vi.fn(() => protocol),
          stop: vi.fn(async () => protocol),
          getState: () => protocol,
        };
      }),
    });

    await runtime.start();
    onState?.({
      ...protocol,
      phase: "thinking",
      assistantText: "가나다",
    });
    await vi.advanceTimersByTimeAsync(600);
    expect(refresh).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(refresh).toHaveBeenCalledOnce();

    onState?.({
      ...protocol,
      phase: "listening",
      assistantText: "가나다라마",
    });
    release?.();
    await vi.advanceTimersByTimeAsync(199);
    expect(transmitted).toEqual(["가나다"]);
    expect(refresh).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(snapshot.assistantText).toBe("가나다라마");

    runtime.dispose();
    vi.useRealTimers();
  });

  it("flushes a completed response without cancelling the session", async () => {
    vi.useFakeTimers();
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(true);
    let onState: ((state: ReturnType<typeof createRealtimeProtocolState>) => void)
      | undefined;
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "listening" as const,
      assistantText: "완료된 답변",
    };
    const cancelResponse = vi.fn(() => protocol);
    const refresh = vi.fn(async () => undefined);
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh,
      createSession: vi.fn((options) => {
        onState = options.onState;
        return {
          start: vi.fn(async () => undefined),
          cancelResponse,
          stop: vi.fn(async () => protocol),
          getState: () => protocol,
        };
      }),
    });

    await runtime.start();
    onState?.(protocol);
    await runtime.interrupt();

    expect(cancelResponse).not.toHaveBeenCalled();
    expect(snapshot).toMatchObject({
      phase: "listening",
      assistantText: "완료된 답변",
    });
    expect(refresh).toHaveBeenCalledOnce();
    runtime.dispose();
    vi.useRealTimers();
  });

  it("cancels generation, reveals the received partial, and resumes listening", async () => {
    vi.useFakeTimers();
    const bridge = new TestBridge();
    let snapshot = createAiHudSnapshot(true);
    let onState: ((state: ReturnType<typeof createRealtimeProtocolState>) => void)
      | undefined;
    const generating = {
      ...createRealtimeProtocolState(),
      phase: "thinking" as const,
      activeResponseId: "response-1",
      assistantText: "받은 부분",
    };
    const cancelled = {
      ...generating,
      phase: "listening" as const,
      retiredResponseIds: ["response-1"],
    };
    const cancelResponse = vi.fn(() => cancelled);
    const refresh = vi.fn(async () => undefined);
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh,
      createSession: vi.fn((options) => {
        onState = options.onState;
        return {
          start: vi.fn(async () => undefined),
          cancelResponse,
          stop: vi.fn(async () => cancelled),
          getState: () => generating,
        };
      }),
    });

    await runtime.start();
    onState?.(generating);
    await runtime.interrupt();

    expect(cancelResponse).toHaveBeenCalledOnce();
    expect(snapshot).toMatchObject({
      phase: "listening",
      assistantText: "받은 부분",
    });
    expect(refresh).toHaveBeenCalledOnce();
    runtime.dispose();
    vi.useRealTimers();
  });

  it("loads MCP settings at session start and uses tap to approve a pending call", async () => {
    const bridge = new TestBridge();
    await writeMcpServers(bridge, [{
      id: "docs",
      name: "Docs",
      url: "https://mcp.example.com/sse",
      allowedTools: [],
      enabled: true,
    }]);
    let snapshot = createAiHudSnapshot(true);
    const protocol = {
      ...createRealtimeProtocolState(),
      phase: "thinking" as const,
      pendingApproval: {
        id: "approval-1",
        serverLabel: "mcp_docs",
        serverName: "Docs",
        toolName: "search",
        argumentsSummary: "{}",
      },
    };
    const approvePendingMcp = vi.fn(() => true);
    const cancelResponse = vi.fn(() => protocol);
    const createSession = vi.fn((_options: unknown) => ({
      start: vi.fn(async () => undefined),
      approvePendingMcp,
      cancelResponse,
      stop: vi.fn(async () => protocol),
      getState: () => protocol,
    }));
    const runtime = createAiRuntime({
      bridge,
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getLocation: () => ({ status: "unavailable" }),
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh: vi.fn(),
      createSession,
    });

    await runtime.start();
    expect(createSession.mock.calls[0]?.[0]).toMatchObject({
      mcpServers: [expect.objectContaining({ id: "docs" })],
      getLocation: expect.any(Function),
    });
    await runtime.interrupt();
    expect(approvePendingMcp).toHaveBeenCalledOnce();
    expect(cancelResponse).not.toHaveBeenCalled();
    runtime.dispose();
  });
});

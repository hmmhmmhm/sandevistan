import { describe, expect, it, vi } from "vitest";
import type { EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { AudioEvent, AudioInputSource, AudioSpeakerRole } from "@evenrealities/even_hub_sdk";
import { createAiRealtimeSession as createRealSession } from "./ai-realtime-session";
import type { AiRealtimeSessionOptions } from "./ai-realtime-session-types";
function createAiRealtimeSession(options: AiRealtimeSessionOptions) {
  return createRealSession({ ...options, createSocket: (url, protocols) => {
    if (url.includes("intent=transcription")) {
      const next = new FakeSocket(protocols); queueMicrotask(() => next.open()); return next;
    }
    if (!options.createSocket) throw new Error("Test socket missing");
    return options.createSocket(url, protocols);
  } });
}
import type { AiWebSearchResult } from "./ai-tools";

class FakeSocket {
  readyState = 0;
  readonly sent: string[] = [];
  readonly protocols: string[];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(protocols: string[], readonly acknowledge = true) {
    this.protocols = protocols;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  server(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }
  fail() {
    this.onerror?.();
  }
  send(value: string) {
    this.sent.push(value);
    if (this.acknowledge && JSON.parse(value).type === "session.update") {
      queueMicrotask(() => this.server({ type: "session.updated" }));
    }
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("G2 Realtime session", () => {
  it("mints a client secret directly with the device-local BYOK", async () => {
    const windowFetch = vi.fn(function (
      this: typeof globalThis,
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) {
      if (this !== globalThis) {
        throw new TypeError("Can only call Window.fetch on instances of Window");
      }
      return Promise.resolve(Response.json({
        value: "ek_test_ephemeral_123456",
        expires_at: 1_800_000_000,
      }));
    });
    vi.stubGlobal("fetch", windowFetch);
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      createSocket: (_url, protocols) => {
        const socket = new FakeSocket(protocols);
        queueMicrotask(() => socket.open());
        return socket;
      },
    });

    try {
      await expect(session.start()).resolves.toBeUndefined();
      expect(windowFetch).toHaveBeenCalledTimes(3);
      expect(windowFetch.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/models");
      expect(windowFetch.mock.calls[1]?.[0]).toBe(
        "https://api.openai.com/v1/realtime/client_secrets",
      );
      expect(windowFetch.mock.calls[1]?.[1]).toMatchObject({
        method: "POST",
        headers: {
          Authorization: "Bearer sk-test-1234567890abcdefghijklmnop",
          "Content-Type": "application/json",
        },
      });
      expect(JSON.parse(String(windowFetch.mock.calls[1]?.[1]?.body)))
        .toEqual({
          session: { type: "realtime", model: "gpt-realtime-2.1" },
        });
    } finally {
      await session.stop();
      vi.unstubAllGlobals();
    }
  });

  it("normalizes a non-JSON token response instead of leaking a parser error", async () => {
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      fetchImpl: async () => new Response("<!doctype html>", {
        status: 404,
        headers: { "content-type": "text/html" },
      }),
      createSocket: () => {
        throw new Error("must not open a socket");
      },
    });

    await expect(session.start()).rejects.toThrow(
      "Could not create Realtime session",
    );
    expect(session.getState()).toMatchObject({
      phase: "error",
      error: "Could not create Realtime session",
    });
  });

  it("cancels the active response without closing the glasses microphone", async () => {
    const audioControl = vi.fn(async () => true);
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    socket?.server({ type: "response.created", response: { id: "r1" } });
    socket?.server({
      type: "response.output_text.delta",
      response_id: "r1",
      delta: "부분 답변",
    });

    expect(session.cancelResponse()).toMatchObject({
      phase: "listening",
      assistantText: "부분 답변",
      retiredResponseIds: ["r1"],
    });
    expect(JSON.parse(socket?.sent.at(-1) ?? "{}")).toMatchObject({
      type: "response.cancel",
      response_id: "r1",
    });
    expect(audioControl).not.toHaveBeenCalledWith(false);

    socket?.server({
      type: "response.output_text.delta",
      response_id: "r1",
      delta: " 늦은 내용",
    });
    expect(session.getState().assistantText).toBe("부분 답변");
    await session.stop();
  });

  it("suppresses a response that is created after an early cancellation", async () => {
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    socket?.server({ type: "input_audio_buffer.speech_stopped" });

    const sentBeforeCancel = socket?.sent.length ?? 0;
    expect(session.cancelResponse()).toMatchObject({ phase: "listening" });
    expect(socket?.sent).toHaveLength(sentBeforeCancel);
    socket?.server({ type: "response.created", response: { id: "late-r1" } });
    expect(JSON.parse(socket?.sent.at(-1) ?? "{}")).toMatchObject({
      type: "response.cancel",
      response_id: "late-r1",
    });
    socket?.server({ type: "response.cancelled", response: { id: "late-r1" } });
    socket?.server({
      type: "response.output_text.delta",
      response_id: "late-r1",
      delta: "취소 뒤 늦은 답변",
    });

    expect(session.getState()).toMatchObject({
      phase: "listening",
      assistantText: "",
    });
    await session.stop();
  });

  it("does not open a socket or microphone after stop wins a pending start", async () => {
    const audioControl = vi.fn(async () => true);
    let releaseToken: ((response: Response) => void) | undefined;
    const tokenResponse = new Promise<Response>((resolve) => {
      releaseToken = resolve;
    });
    const createSocket = vi.fn((_url: string, protocols: string[]) => {
      const socket = new FakeSocket(protocols);
      queueMicrotask(() => socket.open());
      return socket;
    });
    let requestSignal: AbortSignal | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: vi.fn(async (_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return tokenResponse;
      }),
      createSocket,
    });

    const starting = session.start();
    await session.stop();
    expect(requestSignal?.aborted).toBe(true);
    releaseToken?.(Response.json({
      value: "ek_test_ephemeral_123456",
      expiresAt: 1_800_000_000,
      model: "gpt-realtime",
    }));

    await expect(starting).rejects.toThrow("cancelled");
    expect(createSocket).not.toHaveBeenCalled();
    expect(audioControl).not.toHaveBeenCalledWith(
      true,
      AudioInputSource.Glasses,
    );
  });

  it("starts the glasses microphone only after an explicit, open session", async () => {
    const audioControl = vi.fn(async () => true);
    let eventListener: ((event: EvenHubEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    const bridge = {
      audioControl,
      onEvenHubEvent(listener: (event: EvenHubEvent) => void) {
        eventListener = listener;
        return unsubscribe;
      },
    };
    let socket: FakeSocket | undefined;
    const states: string[] = [];
    const eventTypes: (string | undefined)[] = [];
    const session = createAiRealtimeSession({
      bridge,
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      fetchImpl: async (_input, init) => {
        expect((init?.headers as Record<string, string>).Authorization)
          .toContain("Bearer sk-test-");
        return Response.json({
          value: "ek_test_ephemeral_123456",
          expiresAt: 1_800_000_000,
          model: "gpt-realtime",
        });
      },
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
      onState: (state, eventType) => {
        states.push(state.phase);
        eventTypes.push(eventType);
      },
    });

    expect(audioControl).not.toHaveBeenCalled();
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    expect(audioControl).not.toHaveBeenCalled();
    expect(socket?.protocols).toContain("realtime");
    expect(socket?.protocols.join(" ")).toContain("ek_test_ephemeral_123456");
    socket?.open();
    await starting;

    expect(audioControl).toHaveBeenCalledWith(
      true,
      AudioInputSource.Glasses,
    );
    expect(JSON.parse(socket?.sent[0] ?? "{}").type).toBe("session.update");
    eventListener?.({
      audioEvent: {
        audioPcm: new Uint8Array([0, 0, 232, 3]),
        source: AudioInputSource.Glasses,
        direction: null,
        speakerRole: AudioSpeakerRole.Unknown,
      },
    });
    const append = JSON.parse(socket?.sent.at(-1) ?? "{}") as {
      type?: string;
      audio?: string;
    };
    expect(append.type).toBe("input_audio_buffer.append");
    expect(atob(append.audio ?? "")).toHaveLength(6);
    expect(states).toContain("listening");
    socket?.server({ type: "input_audio_buffer.speech_started" });
    socket?.server({ type: "response.done", response: { id: "r1" } });
    expect(eventTypes).toContain("response.done");

    await session.stop();
    expect(audioControl).toHaveBeenLastCalledWith(false);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(socket?.readyState).toBe(3);
  });

  it("cleans up the microphone when the server reports an error", async () => {
    const audioControl = vi.fn(async () => true);
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    socket?.server({ type: "error", error: { message: "failed" } });
    await vi.waitFor(() => (
      expect(audioControl).toHaveBeenLastCalledWith(false)
    ));
  });

  it("cleans up an already-open microphone on a socket transport error", async () => {
    const audioControl = vi.fn(async () => true);
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;

    socket?.fail();

    await vi.waitFor(() => (
      expect(audioControl).toHaveBeenLastCalledWith(false)
    ));
  });

  it("retries microphone cleanup during stop and then resolves", async () => {
    let closeAttempts = 0;
    const audioControl = vi.fn(async (isOpen: boolean) => {
      if (isOpen) return true;
      closeAttempts += 1;
      return closeAttempts >= 2;
    });
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;

    await expect(session.stop()).resolves.toMatchObject({ phase: "idle" });
    expect(closeAttempts).toBe(2);
  });

  it("waits for a pending microphone activation and closes it before stop resolves", async () => {
    let releaseMicrophone: ((opened: boolean) => void) | undefined;
    const activation = new Promise<boolean>((resolve) => {
      releaseMicrophone = resolve;
    });
    const audioControl = vi.fn(async (isOpen: boolean) => (
      isOpen ? activation : true
    ));
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await vi.waitFor(() => expect(audioControl).toHaveBeenCalledWith(
      true,
      AudioInputSource.Glasses,
    ));

    let stopped = false;
    const stopping = session.stop().then(() => { stopped = true; });
    const earlyResult = await Promise.race([
      stopping.then(() => "stopped" as const),
      new Promise<"pending">((resolve) => {
        setTimeout(() => resolve("pending"), 10);
      }),
    ]);
    expect(earlyResult).toBe("pending");
    expect(stopped).toBe(false);
    releaseMicrophone?.(true);

    await stopping;
    await expect(starting).rejects.toThrow("cancelled");
    expect(audioControl).toHaveBeenLastCalledWith(false);
    expect(session.getState().phase).not.toBe("listening");
  });

  it("closes a microphone that finishes opening after a socket error", async () => {
    let releaseMicrophone: ((opened: boolean) => void) | undefined;
    const activation = new Promise<boolean>((resolve) => {
      releaseMicrophone = resolve;
    });
    const audioControl = vi.fn(async (isOpen: boolean) => (
      isOpen ? activation : true
    ));
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await vi.waitFor(() => expect(audioControl).toHaveBeenCalledWith(
      true,
      AudioInputSource.Glasses,
    ));

    socket?.fail();
    releaseMicrophone?.(true);

    await expect(starting).rejects.toThrow("cancelled");
    await vi.waitFor(() => (
      expect(audioControl).toHaveBeenLastCalledWith(false)
    ));
    expect(session.getState().phase).toBe("error");
  });

  it("releases transport and returns idle even when microphone closure is unconfirmed", async () => {
    const audioControl = vi.fn(async (isOpen: boolean) => isOpen);
    const order: string[] = [];
    const unsubscribe = vi.fn(() => { order.push("unsubscribe"); });
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: async (isOpen) => {
          if (!isOpen) order.push("microphone");
          return audioControl(isOpen);
        },
        onEvenHubEvent: () => unsubscribe,
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        const close = socket.close.bind(socket);
        socket.close = () => {
          order.push("socket");
          close();
        };
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;

    await expect(session.stop()).resolves.toMatchObject({
      phase: "idle",
      error: undefined,
    });
    expect(order.slice(0, 2)).toEqual(["unsubscribe", "socket"]);
    expect(order.filter((value) => value === "microphone")).toHaveLength(2);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(socket?.readyState).toBe(3);
    expect(session.getState()).toMatchObject({
      phase: "idle",
      error: undefined,
    });
  });

  it("executes each built-in function call once and continues the response", async () => {
    let socket: FakeSocket | undefined;
    let finishSearch: ((value: AiWebSearchResult) => void) | undefined;
    const searchWeb = vi.fn(() => new Promise<AiWebSearchResult>((resolve) => {
      finishSearch = resolve;
    }));
    const toolStates: Array<unknown> = [];
    const result = {
      answer: "Current result [1]",
      sources: [{ title: "Source", url: "https://example.com/source" }],
      usage: {
        model: "gpt-5.5",
        inputTokens: 3,
        cachedInputTokens: 1,
        outputTokens: 4,
        webSearchCalls: 1,
      },
    } satisfies AiWebSearchResult;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "en",
      getLocation: () => ({ status: "unavailable" }),
      searchWeb,
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
      onState: (state) => toolStates.push(state.activeTool),
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    const event = {
      type: "response.done",
      response: {
        id: "r-tools",
        output: [{
          type: "function_call",
          name: "search_web",
          call_id: "call-1",
          arguments: JSON.stringify({ query: "current result" }),
        }],
      },
    };
    socket?.server(event);
    socket?.server(event);

    await vi.waitFor(() => expect(searchWeb).toHaveBeenCalledOnce());
    expect(session.getState().activeTool).toEqual({
      id: "call-1",
      kind: "web-search",
    });
    finishSearch?.(result);
    await vi.waitFor(() => expect(socket?.sent.some((raw) => {
      const sent = JSON.parse(raw);
      return sent.type === "conversation.item.create"
        && sent.item?.type === "function_call_output"
        && sent.item?.call_id === "call-1";
    })).toBe(true));
    expect(socket?.sent.filter((raw) => JSON.parse(raw).type === "response.create"))
      .toHaveLength(1);
    expect(session.getState().sources).toEqual([
      { title: "Source", url: "https://example.com/source" },
    ]);
    expect(session.getState().activeTool).toBeUndefined();
    expect(toolStates).toContainEqual({ id: "call-1", kind: "web-search" });
    expect(session.getState().usage).toMatchObject({
      searchTextInputTokens: 2,
      cachedSearchTextInputTokens: 1,
      searchTextOutputTokens: 4,
      webSearchCalls: 1,
    });
    expect(session.getState().charge.estimatedNanoUsd).toBeGreaterThan(0);
    await session.stop();
  });

  it("requires a tap approval for MCP calls and rejects a pending call on stop", async () => {
    let socket: FakeSocket | undefined;
    const session = createAiRealtimeSession({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: () => vi.fn(),
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      mcpServers: [{
        id: "docs",
        name: "Docs MCP",
        url: "https://mcp.example.com/sse",
        allowedTools: [],
        enabled: true,
      }],
      fetchImpl: async () => Response.json({
        value: "ek_test_ephemeral_123456",
        expiresAt: 1_800_000_000,
        model: "gpt-realtime",
      }),
      createSocket: (_url, protocols) => {
        socket = new FakeSocket(protocols);
        return socket;
      },
    });
    const starting = session.start();
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket?.open();
    await starting;
    socket?.server({
      type: "conversation.item.done",
      item: {
        type: "mcp_approval_request",
        id: "approval-1",
        server_label: "mcp_docs",
        name: "search",
        arguments: "{\"query\":\"private\"}",
      },
    });
    expect(session.getState().pendingApproval).toMatchObject({
      id: "approval-1",
      serverName: "Docs MCP",
      toolName: "search",
    });
    expect(session.approvePendingMcp?.()).toBe(true);
    expect(JSON.parse(socket?.sent.at(-1) ?? "{}")).toEqual({
      type: "conversation.item.create",
      item: {
        type: "mcp_approval_response",
        approval_request_id: "approval-1",
        approve: true,
      },
    });
    socket?.server({
      type: "response.mcp_call.in_progress",
      item_id: "mcp-call-1",
      name: "search",
      server_label: "mcp_docs",
    });
    expect(session.getState().activeTool).toEqual({
      id: "mcp-call-1",
      kind: "mcp",
      displayName: "search",
    });
    socket?.server({
      type: "response.output_item.done",
      item: {
        type: "mcp_call",
        id: "mcp-call-1",
        name: "search",
        server_label: "mcp_docs",
        status: "completed",
      },
    });
    expect(session.getState().activeTool).toBeUndefined();

    socket?.server({
      type: "conversation.item.done",
      item: {
        type: "mcp_approval_request",
        id: "approval-2",
        server_label: "mcp_docs",
        name: "read",
        arguments: "{}",
      },
    });
    await session.stop();
    expect(socket?.sent.some((raw) => {
      const sent = JSON.parse(raw);
      return sent.item?.approval_request_id === "approval-2"
        && sent.item?.approve === false;
    })).toBe(true);
  });
});

it("ignores a socket close notification delivered after explicit stop completes", async () => {
  let socket: FakeSocket | undefined;
  const session = createAiRealtimeSession({
    key: "sk-test-1234567890abcdefghijklmnop", locale: "ko",
    bridge: { audioControl: vi.fn(async () => true), onEvenHubEvent: () => () => undefined },
    fetchImpl: vi.fn(async () => Response.json({ value: "ek_test_ephemeral" })),
    createSocket: (_url, protocols) => {
      socket = new FakeSocket(protocols);
      socket.close = () => {};
      queueMicrotask(() => socket?.open());
      return socket;
    },
  });
  await session.start();
  await session.stop();
  socket?.onclose?.();
  expect(session.getState().phase).toBe("idle");
});


it("waits for acknowledged configuration and answers the displayed transcript", async () => {
  const audioControl = vi.fn(async () => true);
  let socket: FakeSocket | undefined;
  const session = createAiRealtimeSession({
    key: "sk-test-1234567890abcdefghijklmnop", locale: "ko",
    bridge: { audioControl, onEvenHubEvent: () => () => undefined },
    fetchImpl: async () => Response.json({ value: "ek_test_ephemeral" }),
    createSocket: (_url, protocols) => {
      socket = new FakeSocket(protocols, false);
      queueMicrotask(() => socket?.open());
      return socket;
    },
  });
  const pending = session.start();
  try {
    await vi.waitFor(() => expect(socket?.sent.length).toBe(1));
    expect(audioControl).not.toHaveBeenCalled();
    expect(session.getState().phase).toBe("connecting");
    socket?.server({ type: "session.updated" });
    await pending;
    expect(audioControl).toHaveBeenCalledWith(true, AudioInputSource.Glasses);
    socket?.server({ type: "input_audio_buffer.speech_started", item_id: "voice-1" });
    socket?.server({ type: "input_audio_buffer.speech_stopped", item_id: "voice-1" });
    expect(socket?.sent.map((s) => JSON.parse(s).type)).not.toContain("response.create");
    socket?.server({ type: "conversation.item.input_audio_transcription.completed", item_id: "voice-1", transcript: "1 더하기 1은?" });
    const events = socket?.sent.map((s) => JSON.parse(s));
    expect(events?.slice(-3)).toEqual([
      { type: "conversation.item.create", previous_item_id: "voice-1", item: { type: "message", role: "user", content: [{ type: "input_text", text: "1 더하기 1은?" }] } },
      { type: "conversation.item.delete", item_id: "voice-1" },
      { type: "response.create" },
    ]);
    socket?.server({ type: "conversation.item.input_audio_transcription.completed", item_id: "voice-1", transcript: "1 더하기 1은?" });
    expect(socket?.sent.filter((s) => JSON.parse(s).type === "response.create")).toHaveLength(1);
  } finally { await session.stop(); await pending.catch(() => undefined); }
});

it("reports an unacknowledged session configuration instead of opening the microphone", async () => {
  vi.useFakeTimers();
  const audioControl = vi.fn(async () => true);
  const session = createAiRealtimeSession({
    key: "sk-test-1234567890abcdefghijklmnop", locale: "ko",
    bridge: { audioControl, onEvenHubEvent: () => () => undefined },
    fetchImpl: async () => Response.json({ value: "ek_test_ephemeral" }),
    createSocket: (_url, protocols) => {
      const socket = new FakeSocket(protocols, false);
      queueMicrotask(() => socket.open());
      return socket;
    },
  });
  const pending = session.start();
  const assertion = expect(pending).rejects.toThrow("configuration timed out");
  try {
    await vi.advanceTimersByTimeAsync(10_100);
    await assertion;
    expect(audioControl).not.toHaveBeenCalled();
    expect(session.getState().phase).toBe("error");
  } finally { await session.stop(); vi.useRealTimers(); }
});

it("ends a stalled post-speech wait and releases the microphone", async () => {
  vi.useFakeTimers();
  let socket: FakeSocket | undefined;
  const audioControl = vi.fn(async () => true);
  const session = createAiRealtimeSession({
    bridge: { audioControl, onEvenHubEvent: () => () => {} }, key: "sk-test-1234567890abcdefghijklmnop", locale: "ko",
    fetchImpl: vi.fn(async () => Response.json({ value: "ek_test_ephemeral_123456" })),
    createSocket: (_url, protocols) => { socket = new FakeSocket(protocols); queueMicrotask(() => socket?.open()); return socket; },
  });
  try {
    await session.start();
    socket?.server({ type: "input_audio_buffer.speech_started", item_id: "stall" });
    socket?.server({ type: "input_audio_buffer.speech_stopped", item_id: "stall" });
    await vi.advanceTimersByTimeAsync(20_001);
    expect(session.getState().phase).toBe("error");
    expect(session.getState().error).toMatch(/timed out/i);
    expect(audioControl).toHaveBeenLastCalledWith(false);
    expect(socket?.readyState).toBe(3);
  } finally { await session.stop(); vi.useRealTimers(); }
});

it("uses live preview and final refinement on one PCM stream, then answers exactly once", async () => {
  const sockets = new Map<string, FakeSocket>();
  let audio: ((event: EvenHubEvent) => void) | undefined;
  const control = vi.fn(async () => true);
  const session = createRealSession({ key: "test", locale: "ko",
    bridge: { audioControl: control, onEvenHubEvent: next => { audio = next; return () => { audio = undefined; }; } },
    fetchImpl: async () => Response.json({ value: "ek_test_123456789" }),
    createSocket: (url, protocols) => { const next = new FakeSocket(protocols); sockets.set(url.includes("intent=transcription") ? "live" : "final", next); queueMicrotask(() => next.open()); return next; },
  });
  try {
    await session.start();
    const main = sockets.get("final"), live = sockets.get("live");
    expect(main).toBeDefined(); expect(live).toBeDefined();
    main?.server({ type: "input_audio_buffer.speech_started", item_id: "main1" });
    audio?.({ audioEvent: new AudioEvent({ source: AudioInputSource.Glasses, audioPcm: new Uint8Array(3200) }) });
    const events = (socket: FakeSocket | undefined) => socket?.sent.map(text => JSON.parse(text)) ?? [];
    expect(events(main).filter(e => e.type === "input_audio_buffer.append")).toEqual(events(live).filter(e => e.type === "input_audio_buffer.append"));
    live?.server({ type: "conversation.item.input_audio_transcription.delta", item_id: "live1", delta: "Provisional name" });
    expect(session.getState().userText).toBe("Provisional name");
    expect(events(main).filter(e => e.type === "response.create")).toHaveLength(0);
    main?.server({ type: "input_audio_buffer.committed", item_id: "main1" });
    live?.server({ type: "input_audio_buffer.committed", item_id: "live1" });
    main?.server({ type: "conversation.item.input_audio_transcription.completed", item_id: "main1", transcript: "Corrected name" });
    expect(session.getState().userText).toBe("Corrected name");
    expect(events(main).filter(e => e.type === "response.create")).toHaveLength(1);
    expect(events(main).find(e => e.type === "conversation.item.create").item.content[0].text).toBe("Corrected name");
    live?.server({ type: "conversation.item.input_audio_transcription.delta", item_id: "live1", delta: " stale" });
    expect(session.getState().userText).toBe("Corrected name");
  } finally { await session.stop(); }
  expect([...sockets.values()].every(s => s.readyState === 3)).toBe(true);
  expect(audio).toBeUndefined();
});

it("keeps the microphone closed until both model configurations are acknowledged", async () => {
  let live: FakeSocket | undefined;
  const control = vi.fn(async () => true);
  const session = createRealSession({ key: "test", locale: "ko",
    bridge: { audioControl: control, onEvenHubEvent: () => () => {} },
    fetchImpl: async () => Response.json({ value: "ek_test_123456789" }),
    createSocket: (url, protocols) => {
      const next = new FakeSocket(protocols, !url.includes("intent=transcription"));
      if (url.includes("intent=transcription")) live = next;
      queueMicrotask(() => next.open()); return next;
    },
  });
  try {
    const starting = session.start();
    await vi.waitFor(() => expect(live?.sent.length).toBe(1));
    expect(control).not.toHaveBeenCalled();
    live?.server({ type: "session.updated" }); await starting;
    expect(control).toHaveBeenCalledWith(true, AudioInputSource.Glasses);
  } finally { await session.stop(); }
});

it("holds microphone input and answer creation to explicit press/release boundaries", async () => {
  let audio: ((event: EvenHubEvent) => void) | undefined;
  const control = vi.fn(async () => true), sockets = new Map<string, FakeSocket>();
  const session = createRealSession({ key: "test", locale: "ko", captureMode: "hold",
    bridge: { audioControl: control, onEvenHubEvent: next => { audio = next; return () => { audio = undefined; }; } },
    fetchImpl: async () => Response.json({ value: "ek_test_123456789" }),
    createSocket: (url, protocols) => { const next = new FakeSocket(protocols); sockets.set(url.includes("intent=transcription") ? "live" : "main", next); queueMicrotask(() => next.open()); return next; },
  });
  const events = (name: string) => sockets.get(name)?.sent.map(s => JSON.parse(s)) ?? [];
  try {
    await session.start(); expect(control).not.toHaveBeenCalled(); expect(audio).toBeUndefined();
    expect(session.getState().captureState).toBe("waiting");
    expect(events("main")[0].session.audio.input.turn_detection).toBeNull();
    await session.capture?.begin();
    const captured = audio;
    captured?.({ audioEvent: new AudioEvent({ source: AudioInputSource.Glasses, audioPcm: new Uint8Array(3200) }) });
    sockets.get("live")?.server({ type: "conversation.item.input_audio_transcription.delta", item_id: "live1", delta: "Live question" });
    expect(session.getState().userText).toBe("Live question");
    expect(events("main").some(e => e.type === "response.create")).toBe(false);
    session.capture?.end();
    captured?.({ audioEvent: new AudioEvent({ source: AudioInputSource.Glasses, audioPcm: new Uint8Array(3200) }) });
    expect(events("main").filter(e => e.type === "input_audio_buffer.append")).toHaveLength(1);
    expect(events("main").filter(e => e.type === "input_audio_buffer.commit")).toHaveLength(1);
    sockets.get("main")?.server({ type: "input_audio_buffer.committed", item_id: "main1" });
    sockets.get("live")?.server({ type: "input_audio_buffer.committed", item_id: "live1" });
    sockets.get("main")?.server({ type: "conversation.item.input_audio_transcription.completed", item_id: "main1", transcript: "Final question" });
    expect(events("main").filter(e => e.type === "response.create")).toHaveLength(1);
    expect(events("main").find(e => e.type === "conversation.item.create").item.content[0].text).toBe("Final question");
    expect(session.getState().userText).toBe("Final question");
    sockets.get("live")?.server({ type: "conversation.item.input_audio_transcription.delta", item_id: "live1", delta: " stale" });
    expect(session.getState().userText).toBe("Final question");
    await vi.waitFor(() => expect(control).toHaveBeenCalledWith(false));
  } finally { await session.stop(); }
});

it("starts a second held question without cancelling the already completed first answer", async () => {
  const sockets = new Map<string,FakeSocket>();
  const session = createRealSession({ key:"test",locale:"ko",captureMode:"hold",
    bridge:{ audioControl:async()=>true,onEvenHubEvent:()=>()=>{} },fetchImpl:async()=>Response.json({value:"ek_test_123456789"}),
    createSocket:(url,protocols)=>{ const next=new FakeSocket(protocols);sockets.set(url.includes("intent=transcription")?"live":"main",next);queueMicrotask(()=>next.open());return next; },
  });
  try {
    await session.start(); const main=sockets.get("main");
    main?.server({type:"response.created",response:{id:"finished-first"}});
    main?.server({type:"response.output_text.done",response_id:"finished-first",text:"First answer"});
    main?.server({type:"response.done",response:{id:"finished-first",status:"completed"}});
    expect(session.getState().responseComplete).toBe(true);
    await session.capture?.begin();
    expect(main?.sent.map(s=>JSON.parse(s)).filter(e=>e.type==="response.cancel")).toEqual([]);
    expect(session.getState().captureState).toBe("recording");
  } finally { await session.stop(); }
});

it("cancels a pending prior answer once its response id arrives during a new hold", async () => {
  const sockets = new Map<string, FakeSocket>();
  const session = createRealSession({ key: "test", locale: "ko", captureMode: "hold",
    bridge: { audioControl: async () => true, onEvenHubEvent: () => () => {} },
    fetchImpl: async () => Response.json({ value: "ek_test_123456789" }),
    createSocket: (url, protocols) => { const next = new FakeSocket(protocols); sockets.set(url.includes("intent=transcription") ? "live" : "main", next); queueMicrotask(() => next.open()); return next; },
  });
  try {
    await session.start(); const main = sockets.get("main");
    main?.server({ type: "input_audio_buffer.speech_stopped", item_id: "prior-question" });
    await session.capture?.begin();
    main?.server({ type: "response.created", response: { id: "late-prior-answer" } });
    const cancellations = main?.sent.map(s => JSON.parse(s)).filter(e => e.type === "response.cancel");
    expect(cancellations).toHaveLength(1);
    expect(cancellations?.[0]).toMatchObject({ response_id: "late-prior-answer" });
    main?.server({ type: "error", error: { code: "response_cancel_not_active", event_id: cancellations?.[0].event_id } });
    expect(session.getState().captureState).toBe("recording");
    expect(session.getState().error).toBeUndefined();
  } finally { await session.stop(); }
});

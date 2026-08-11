import { AudioInputSource } from "@evenrealities/even_hub_sdk";
import { requestAiWebSearch } from "./ai-web-search";
import {
  createAiRealtimeToolRunner,
  mcpToolLifecycleUpdate,
  mcpApprovalRequest,
  mcpApprovalResponse,
  responseFunctionCalls,
} from "./ai-realtime-tools";
import {
  createDefaultRealtimeSocket,
  type RealtimeSocket,
} from "./ai-realtime-transport";
import {
  addAiSearchUsage,
  mergeAiCitationSources,
} from "./ai-realtime-search-usage";
import { requestRealtimeClientSecret } from "./ai-realtime-token";
import { createSonioxRealtimeSession, type SonioxRealtimeSession } from "./soniox-realtime-session";
import type {
  AiRealtimeSession,
  AiRealtimeSessionOptions,
} from "./ai-realtime-session-types";
import {
  cancelActiveRealtimeResponse,
  createAudioAppendEvent,
  createRealtimeProtocolState,
  createRealtimeSessionUpdate,
  resamplePcm16Le16To24,
  reduceRealtimeServerEvent,
  type AiRealtimeProtocolState,
} from "./ai-realtime-protocol";

export type { AiRealtimeSession } from "./ai-realtime-session-types";

const REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime";
const SOCKET_OPEN = 1;
const MAX_PCM_CHUNK_BYTES = 65_536;
export function createAiRealtimeSession(
  options: AiRealtimeSessionOptions,
): AiRealtimeSession {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const createSocket = options.createSocket ?? createDefaultRealtimeSocket;
  let state = createRealtimeProtocolState();
  let socket: RealtimeSocket | undefined;
  let unsubscribeAudio: (() => void) | undefined;
  let microphoneOpen = false;
  let microphoneActivation: Promise<boolean> | undefined;
  let starting = false;
  let closing = false;
  let cleanupPromise: Promise<boolean> | undefined;
  let lifecycle = 0;
  let pendingResponseCancel = false;
  let suppressCancelledResponse = false;
  let startAbortController: AbortController | undefined;
  let sonioxSession: SonioxRealtimeSession | undefined;

  const publish = (next: AiRealtimeProtocolState, eventType?: string) => {
    state = next;
    options.onState?.(state, eventType);
  };

  const send = (event: unknown) => {
    if (socket?.readyState !== SOCKET_OPEN) return;
    socket.send(JSON.stringify(event));
  };

  const mcpServers = options.mcpServers ?? [];
  const toolRunner = createAiRealtimeToolRunner({
    locale: options.locale,
    now: options.now ?? (() => new Date()),
    getLocation: options.getLocation ?? (() => ({ status: "unavailable" })),
    searchWeb: options.searchWeb ?? ((query, locale, signal) => (
      requestAiWebSearch({
        key: options.key,
        query,
        locale,
        signal,
        fetchImpl,
      })
    )),
    send,
    onSources: (sources) => {
      publish(mergeAiCitationSources(state, sources), "tool.sources");
    },
    onSearchUsage: (usage) => {
      publish(addAiSearchUsage(state, usage), "tool.usage");
    },
    onActiveTool: (activeTool) => {
      if (activeTool) {
        publish({ ...state, activeTool }, "tool.active");
      } else if (state.activeTool?.kind !== "mcp") {
        publish({ ...state, activeTool: undefined }, "tool.complete");
      }
    },
  });

  const closeMicrophone = async (attempts = 2): Promise<boolean> => {
    if (!microphoneOpen) return true;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const closed = await options.bridge.audioControl(false)
        .catch(() => false);
      if (closed) {
        microphoneOpen = false;
        return true;
      }
    }
    return false;
  };

  const cleanup = (finalPhase: "idle" | "error" = "idle") => {
    lifecycle += 1;
    cleanupPromise ??= (async () => {
      closing = true;
      if (state.pendingApproval) {
        send(mcpApprovalResponse(state.pendingApproval.id, false));
        state = { ...state, pendingApproval: undefined };
      }
      toolRunner.cancel();
      startAbortController?.abort();
      startAbortController = undefined;
      const activation = microphoneActivation;
      unsubscribeAudio?.();
      unsubscribeAudio = undefined;
      const activeSocket = socket;
      socket = undefined;
      const activeSonioxSession = sonioxSession;
      sonioxSession = undefined;
      pendingResponseCancel = false;
      suppressCancelledResponse = false;
      activeSocket?.close();
      await activeSonioxSession?.stop();
      if (activation) {
        const opened = await activation.catch(() => false);
        if (microphoneActivation === activation) {
          microphoneActivation = undefined;
        }
        if (opened) microphoneOpen = true;
      }
      const microphoneClosed = await closeMicrophone();
      microphoneOpen = false;
      starting = false;
      if (finalPhase === "idle") {
        publish({
          ...state,
          phase: "idle",
          activeTool: undefined,
          responseComplete: false,
          error: undefined,
        });
      }
      return microphoneClosed;
    })().finally(() => {
      closing = false;
      cleanupPromise = undefined;
    });
    return cleanupPromise;
  };

  const activateMicrophone = () => {
    const activation = Promise.resolve().then(() => (
      options.bridge.audioControl(true, AudioInputSource.Glasses)
    ));
    microphoneActivation = activation;
    return activation.finally(() => {
      if (microphoneActivation === activation) {
        microphoneActivation = undefined;
      }
    });
  };

  const subscribeAudio = () => {
    unsubscribeAudio = options.bridge.onEvenHubEvent((event) => {
      const audio = event.audioEvent;
      if (
        !microphoneOpen
        || socket?.readyState !== SOCKET_OPEN
        || !audio
        || audio.source !== AudioInputSource.Glasses
        || audio.audioPcm.length === 0
        || audio.audioPcm.length > MAX_PCM_CHUNK_BYTES
      ) {
        return;
      }
      const resampled = resamplePcm16Le16To24(audio.audioPcm);
      if (resampled.length > 0) send(createAudioAppendEvent(resampled));
    });
  };

  const submitSonioxTranscript = (itemId: string, text: string) => {
    const transcript = text.trim();
    if (!transcript) return;
    if (state.phase === "thinking") cancelActiveResponse();
    if (state.activeUserItemId !== itemId) {
      publish(reduceRealtimeServerEvent(state, {
        type: "input_audio_buffer.speech_started",
        item_id: itemId,
      }), "soniox.speech_started");
    }
    publish({
      ...state,
      phase: "thinking",
      activeUserItemId: itemId,
      userText: transcript,
      assistantText: "",
      activeResponseId: undefined,
      responseComplete: false,
      error: undefined,
    }, "soniox.transcript");
    send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: transcript }],
      },
    });
    send({ type: "response.create" });
  };

  const cancelActiveResponse = () => {
    toolRunner.cancel();
    if (state.phase !== "thinking") return state;
    suppressCancelledResponse = true;
    pendingResponseCancel = !state.activeResponseId;
    if (state.activeResponseId) {
      send({ type: "response.cancel", response_id: state.activeResponseId });
    }
    const next = cancelActiveRealtimeResponse(state);
    publish(next, "response.cancel");
    return next;
  };

  const openSocket = (secret: string): Promise<void> => new Promise(
    (resolve, reject) => {
      const nextSocket = createSocket(REALTIME_URL, [
        "realtime",
        `openai-insecure-api-key.${secret}`,
      ]);
      socket = nextSocket;
      let settled = false;
      const timeout = globalThis.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Realtime connection timed out"));
      }, 10_000);
      nextSocket.onopen = () => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeout);
        resolve();
      };
      nextSocket.onerror = () => {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timeout);
          reject(new Error("Realtime connection failed"));
          return;
        }
        if (closing) return;
        publish({
          ...state,
          phase: "error",
          activeTool: undefined,
          responseComplete: false,
          error: "Realtime connection failed",
        });
        void cleanup("error");
      };
      nextSocket.onclose = () => {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timeout);
          reject(new Error("Realtime connection closed"));
          return;
        }
        if (closing) return;
        publish({
          ...state,
          phase: "error",
          activeTool: undefined,
          responseComplete: false,
          error: "Realtime connection closed",
        });
        void cleanup("error");
      };
      nextSocket.onmessage = (event) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        const eventType = typeof parsed === "object"
          && parsed !== null
          && "type" in parsed
          && typeof parsed.type === "string"
          ? parsed.type
          : undefined;
        const parsedRecord = typeof parsed === "object" && parsed !== null
          ? parsed as Record<string, unknown>
          : undefined;
        const parsedResponse = typeof parsedRecord?.response === "object"
          && parsedRecord.response !== null
          ? parsedRecord.response as Record<string, unknown>
          : undefined;
        const parsedResponseId = typeof parsedRecord?.response_id === "string"
          ? parsedRecord.response_id
          : typeof parsedResponse?.id === "string"
            ? parsedResponse.id
            : undefined;
        const approval = mcpApprovalRequest(parsed, mcpServers);
        if (approval) {
          if (state.pendingApproval) {
            send(mcpApprovalResponse(approval.id, false));
            return;
          }
          publish({
            ...state,
            phase: "thinking",
            pendingApproval: approval,
          }, "mcp_approval_request");
          return;
        }
        const toolLifecycle = mcpToolLifecycleUpdate(parsed);
        if (toolLifecycle && "activeTool" in toolLifecycle) {
          publish({
            ...state,
            phase: "thinking",
            activeTool: toolLifecycle.activeTool,
          }, "mcp.active");
        } else if (
          toolLifecycle
          && state.activeTool?.id === toolLifecycle.clearId
        ) {
          publish({ ...state, activeTool: undefined }, "mcp.complete");
        }
        if (eventType === "input_audio_buffer.speech_started") {
          pendingResponseCancel = false;
          suppressCancelledResponse = false;
        }
        if (
          suppressCancelledResponse
          && pendingResponseCancel
          && eventType?.startsWith("response.")
          && parsedResponseId
        ) {
          send({
            type: "response.cancel",
            response_id: parsedResponseId,
          });
          publish(cancelActiveRealtimeResponse({
            ...state,
            phase: "thinking",
            activeResponseId: parsedResponseId,
          }), "response.cancel");
          pendingResponseCancel = false;
        }
        if (
          suppressCancelledResponse
          && eventType?.startsWith("response.")
          && eventType !== "response.done"
          && eventType !== "response.cancelled"
        ) {
          return;
        }
        if (
          eventType === "response.done"
          || eventType === "response.cancelled"
        ) {
          pendingResponseCancel = false;
          suppressCancelledResponse = false;
        }
        const next = reduceRealtimeServerEvent(state, parsed as never);
        const hasFunctionCalls = eventType === "response.done"
          && responseFunctionCalls(parsed).length > 0;
        if (hasFunctionCalls) {
          const published = {
            ...next,
            phase: "thinking" as const,
            activeResponseId: undefined,
            responseComplete: false,
          };
          toolRunner.handle(parsed, () => publish(published, eventType));
          return;
        }
        const published = next;
        if (published !== state) publish(published, eventType);
        if (published.phase === "error") void cleanup("error");
      };
    },
  );

  return {
    async start() {
      if (starting || socket) return;
      starting = true;
      const operation = ++lifecycle;
      const abortController = new AbortController();
      startAbortController = abortController;
      publish({ ...createRealtimeProtocolState(), phase: "connecting" });
      try {
        const secret = await requestRealtimeClientSecret({
          fetchImpl,
          key: options.key,
          signal: abortController.signal,
        });
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        await openSocket(secret);
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        send(createRealtimeSessionUpdate(options.locale, mcpServers));
        if (options.sonioxKey) {
          sonioxSession = (options.createSonioxSession ?? createSonioxRealtimeSession)({
            bridge: options.bridge,
            key: options.sonioxKey,
            onPartial: (itemId, text) => {
              if (state.phase === "thinking") cancelActiveResponse();
              if (state.activeUserItemId !== itemId) {
                publish(reduceRealtimeServerEvent(state, {
                  type: "input_audio_buffer.speech_started", item_id: itemId,
                }), "soniox.speech_started");
              }
              publish({ ...state, activeUserItemId: itemId, userText: text, phase: "listening" }, "soniox.partial");
            },
            onCompleted: submitSonioxTranscript,
            onError: (message) => {
              publish({ ...state, phase: "error", error: message }, "soniox.error");
              void cleanup("error");
            },
          });
          await sonioxSession.start();
        } else {
          subscribeAudio();
          const opened = await activateMicrophone();
          microphoneOpen = opened;
          if (!opened) throw new Error("G2 microphone unavailable");
        }
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        publish({ ...state, phase: "listening", error: undefined });
      } catch (error) {
        if (operation !== lifecycle) {
          await cleanup(state.phase === "error" ? "error" : "idle");
          throw new Error("Realtime start cancelled");
        }
        publish({
          ...state,
          phase: "error",
          activeTool: undefined,
          responseComplete: false,
          error: error instanceof Error
            ? error.message.slice(0, 160)
            : "Realtime session failed",
        });
        await cleanup("error");
        throw error;
      } finally {
        if (startAbortController === abortController) {
          startAbortController = undefined;
        }
        starting = false;
      }
    },
    approvePendingMcp() {
      const approval = state.pendingApproval;
      if (!approval) return false;
      send(mcpApprovalResponse(approval.id, true));
      publish({
        ...state,
        phase: "thinking",
        pendingApproval: undefined,
      }, "mcp_approval_response");
      return true;
    },
    cancelResponse() {
      return cancelActiveResponse();
    },
    async stop() {
      await cleanup();
      return state;
    },
    getState() {
      return state;
    },
  };
}

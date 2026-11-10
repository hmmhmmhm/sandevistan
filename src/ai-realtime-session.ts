import { createAiResponseCancellation } from "./ai-response-cancellation";
import { createAiHoldCapture } from "./ai-hold-capture";
import { createAiMicrophone } from "./ai-microphone";
import { createAiLiveCaptions } from "./ai-live-captions";
import { createAiResponseWatchdog } from "./ai-response-watchdog";
import { createRealtimeTranscriptInput } from "./ai-realtime-transcript-input";
import { resolveOpenAiModels, DEFAULT_OPENAI_MODELS } from "./openai-models";
import { requestAiWebSearch } from "./ai-web-search";
import {
  createAiRealtimeToolRunner,
  mcpToolLifecycleUpdate,
  mcpApprovalRequest,
  mcpApprovalResponse,
  responseFunctionCalls,
} from "./ai-realtime-tools";
import { createDefaultRealtimeSocket, type RealtimeSocket } from "./ai-realtime-transport";
import { addAiSearchUsage, mergeAiCitationSources } from "./ai-realtime-search-usage";
import { requestRealtimeClientSecret } from "./ai-realtime-token";
import type { AiRealtimeSession, AiRealtimeSessionOptions } from "./ai-realtime-session-types";
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
const REALTIME_URL = "wss://api.openai.com/v1/realtime";
const SOCKET_OPEN = 1;
export function createAiRealtimeSession(
  options: AiRealtimeSessionOptions,
): AiRealtimeSession {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const createSocket = options.createSocket ?? createDefaultRealtimeSocket;
  let models = DEFAULT_OPENAI_MODELS;
  let state = createRealtimeProtocolState();
  let socket: RealtimeSocket | undefined;
  let starting = false;
  let closing = false;
  let cleanupPromise: Promise<boolean> | undefined;
  let lifecycle = 0;
  let pendingResponseCancel = false;
  let suppressCancelledResponse = false;
  let startAbortController: AbortController | undefined;
  const watchdog = createAiResponseWatchdog(() => {
    publish({ ...state, phase: "error", activeTool: undefined, responseComplete: false, error: "AI response timed out" });
    void cleanup("error");
  });
  const publish = (next: AiRealtimeProtocolState, eventType?: string) => {
    state = next;
    watchdog.observe(next);
    options.onState?.(state, eventType);
  };
  const send = (event: unknown) => {
    if (socket?.readyState !== SOCKET_OPEN) return;
    socket.send(JSON.stringify(event));
  };
  const cancellation = createAiResponseCancellation(send);
  const transcriptInput = createRealtimeTranscriptInput(send);
  const captions = createAiLiveCaptions({ key: options.key, fetchImpl, createSocket,
    onPartial: (itemId, text) => {
      if (!closing && state.activeUserItemId === itemId) publish({ ...state, userText: text }, "caption.partial");
    },
    onUsage: () => publish({ ...state, charge: { ...state.charge, unpricedEvents: state.charge.unpricedEvents + 1 } }, "caption.usage"),
    onError: () => {
      publish({ ...state, phase: "error", error: "Live transcription connection failed" });
      void cleanup("error");
    },
  });
  const mcpServers = options.mcpServers ?? [];
  const toolRunner = createAiRealtimeToolRunner({
    fetchImpl,
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
        model: models.search,
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
  const microphone = createAiMicrophone(options.bridge, bytes => {
    if (closing || socket?.readyState !== SOCKET_OPEN || (hold && !hold.acceptsAudio())) return;
    hold?.countAudio(bytes.length);
    const resampled = resamplePcm16Le16To24(bytes);
    if (resampled.length) { const append = createAudioAppendEvent(resampled); send(append); captions.append(append); }
  });
  const hold = options.captureMode === "hold" ? createAiHoldCapture({
    ready: () => !starting && !closing && !state.pendingApproval && socket?.readyState === SOCKET_OPEN,
    open: () => microphone.start(), close: () => microphone.stop(),
    clear: () => { send({ type: "input_audio_buffer.clear" }); captions.clear(); },
    commit: () => send({ type: "input_audio_buffer.commit" }),
    onBegin: id => {
      const awaiting = state.phase === "thinking" && !state.responseComplete;
      toolRunner.cancel();
      suppressCancelledResponse = awaiting; pendingResponseCancel = awaiting && !state.activeResponseId;
      if (awaiting && state.activeResponseId) cancellation.cancel(state.activeResponseId);
      const event = { type: "input_audio_buffer.speech_started", item_id: id };
      captions.handlePrimary(event); publish(reduceRealtimeServerEvent(state, event), "capture.begin");
    },
    onCommitted: (previous, itemId) => { captions.rebind(previous, itemId); publish({ ...state, activeUserItemId: itemId }); },
    onStatus: captureState => publish({ ...state, captureState,
      phase: captureState === "finishing" ? "thinking" : captureState === "waiting" && state.activeResponseId ? state.phase : "listening" }, "capture.state"),
    onError: error => { publish({ ...state, phase: "error", error }); void cleanup("error"); },
  }) : undefined;
  const cleanup = (finalPhase: "idle" | "error" = "idle") => {
    lifecycle += 1;
    watchdog.clear();
    cleanupPromise ??= (async () => {
      closing = true;
      if (state.pendingApproval) {
        send(mcpApprovalResponse(state.pendingApproval.id, false));
        state = { ...state, pendingApproval: undefined };
      }
      toolRunner.cancel();
      hold?.dispose();
      startAbortController?.abort();
      startAbortController = undefined;
      const microphoneStopping = microphone.stop();
      const activeSocket = socket;
      socket = undefined;
      pendingResponseCancel = false;
      suppressCancelledResponse = false;
      transcriptInput.reset(); cancellation.reset();
      captions.stop();
      activeSocket?.close();
      const microphoneClosed = await microphoneStopping;
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
  const openSocket = (secret: string): Promise<void> => new Promise(
    (resolve, reject) => {
      const nextSocket = createSocket(`${REALTIME_URL}?model=${models.realtime}`, [
        "realtime",
        `openai-insecure-api-key.${secret}`,
      ]);
      socket = nextSocket;
      let settled = false;
      const timeout = globalThis.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Realtime configuration timed out"));
      }, 10_000);
      nextSocket.onopen = () => {
        if (!settled) send(createRealtimeSessionUpdate(options.locale, mcpServers, models.realtime, models.refinement, Boolean(hold)));
      };
      nextSocket.onerror = () => {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timeout);
          reject(new Error("Realtime connection failed"));
          return;
        }
        if (closing || socket !== nextSocket) return;
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
        if (closing || socket !== nextSocket) return;
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
        if (closing || socket !== nextSocket) return;
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
        if (eventType === "session.created" || cancellation.consumeExpectedError(parsed)) return;
        if (!settled && eventType === "session.updated") {
          settled = true;
          globalThis.clearTimeout(timeout);
          resolve();
          return;
        }
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
          cancellation.cancel(parsedResponseId);
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
        hold?.handle(parsed);
        captions.handlePrimary(parsed);
        if (eventType === "conversation.item.input_audio_transcription.delta") return;
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
        if (next !== state) publish(next, eventType);
        transcriptInput.handle(parsed, state.activeUserItemId, suppressCancelledResponse);
        if (next.phase === "error") void cleanup("error");
      };
    },
  );
  return {
    capture: hold,
    async start() {
      if (starting || socket) return;
      starting = true;
      const operation = ++lifecycle;
      const abortController = new AbortController();
      startAbortController = abortController;
      publish({ ...createRealtimeProtocolState(), phase: "connecting" });
      try {
        models = await resolveOpenAiModels(options.key, fetchImpl, abortController.signal);
        state = { ...state, model: models.realtime, transcriptionModel: models.refinement };
        const secret = await requestRealtimeClientSecret({
          fetchImpl,
          key: options.key,
          model: models.realtime,
          signal: abortController.signal,
        });
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        await openSocket(secret);
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        await captions.start(abortController.signal);
        if (operation !== lifecycle) throw new Error("Realtime start cancelled");
        const opened = hold ? true : await microphone.start();
        if (operation !== lifecycle) {
          throw new Error("Realtime start cancelled");
        }
        if (!opened) throw new Error("G2 microphone unavailable");
        publish({ ...state, phase: "listening", captureState: hold ? "waiting" : undefined, error: undefined });
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
      toolRunner.cancel();
      if (state.phase !== "thinking") return state;
      suppressCancelledResponse = true;
      pendingResponseCancel = !state.activeResponseId;
      if (state.activeResponseId) {
        cancellation.cancel(state.activeResponseId);
      }
      publish(cancelActiveRealtimeResponse(state), "response.cancel");
      return state;
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

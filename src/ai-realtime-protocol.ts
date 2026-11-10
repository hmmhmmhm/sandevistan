import type { AiCaptureState } from "./ai-hold-capture";
import {
  addAiUsage,
  EMPTY_AI_USAGE,
  type AiUsage,
} from "./ai-cost";
import type { AiCitationSource } from "./ai-tools";
import type { AiActiveTool, AiMcpApproval } from "./ai-realtime-tools";
import {
  emptyAiUsageCharge,
  mergeAiUsageCharge,
  priceRealtimeUsage,
  priceTranscriptionUsage,
  type AiUsageCharge,
} from "./ai-pricing";
import {
  usageFromResponse,
  usageFromTranscription,
  type RealtimeServerEvent,
} from "./ai-realtime-usage";

export {
  createAudioAppendEvent,
  resamplePcm16Le16To24,
} from "./ai-realtime-audio";
export { createRealtimeSessionUpdate } from "./ai-realtime-session-update";

export type AiRealtimePhase =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "error";

export type AiConversationTurn = {
  readonly user: string;
  readonly assistant: string;
};

type AiConversationTurnRef = {
  readonly userItemId?: string;
  readonly responseId?: string;
};

export type AiRealtimeProtocolState = {
  readonly captureState?: AiCaptureState;
  readonly model?: string;
  readonly transcriptionModel?: string;
  readonly phase: AiRealtimePhase;
  readonly turns: readonly AiConversationTurn[];
  readonly userText: string;
  readonly assistantText: string;
  readonly usage: AiUsage;
  readonly charge: AiUsageCharge;
  readonly responseComplete: boolean;
  readonly activeTool?: AiActiveTool;
  readonly activeUserItemId?: string;
  readonly activeResponseId?: string;
  readonly retiredUserItemIds: readonly string[];
  readonly retiredResponseIds: readonly string[];
  readonly turnRefs: readonly AiConversationTurnRef[];
  readonly sources: readonly AiCitationSource[];
  readonly pendingApproval?: AiMcpApproval;
  readonly error?: string;
};

export function createRealtimeProtocolState(): AiRealtimeProtocolState {
  return {
    phase: "idle",
    turns: [],
    userText: "",
    assistantText: "",
    usage: EMPTY_AI_USAGE,
    charge: emptyAiUsageCharge(),
    responseComplete: false,
    retiredUserItemIds: [],
    retiredResponseIds: [],
    turnRefs: [],
    sources: [],
  };
}

function boundedText(value: string, maximum = 4_000): string {
  return value.replace(/\u0000/g, "").slice(-maximum);
}

type ConversationTimeline = {
  turns: readonly AiConversationTurn[];
  turnRefs: readonly AiConversationTurnRef[];
};

function boundTimeline(
  turns: readonly AiConversationTurn[],
  turnRefs: readonly AiConversationTurnRef[],
): ConversationTimeline {
  const entries = turns.map((turn, index) => ({
    turn,
    ref: turnRefs[index] ?? {},
  })).slice(-12);
  let characters = entries.reduce(
    (total, entry) => total
      + entry.turn.user.length
      + entry.turn.assistant.length,
    0,
  );
  while (entries.length > 1 && characters > 8_000) {
    const removed = entries.shift();
    characters -= (removed?.turn.user.length ?? 0)
      + (removed?.turn.assistant.length ?? 0);
  }
  return {
    turns: entries.map((entry) => entry.turn),
    turnRefs: entries.map((entry) => entry.ref),
  };
}

function archiveCurrentTurn(
  state: AiRealtimeProtocolState,
): ConversationTimeline {
  const user = boundedText(state.userText).trim();
  const assistant = boundedText(state.assistantText).trim();
  if (
    !user
    && !assistant
    && !state.activeUserItemId
    && !state.activeResponseId
  ) {
    return { turns: state.turns, turnRefs: state.turnRefs };
  }
  return boundTimeline(
    [...state.turns, { user, assistant }],
    [
      ...state.turnRefs,
      {
        userItemId: state.activeUserItemId,
        responseId: state.activeResponseId,
      },
    ],
  );
}

function retireId(
  ids: readonly string[],
  id: string | undefined,
): readonly string[] {
  if (!id || ids.includes(id)) return ids;
  return [...ids, id].slice(-12);
}

export function cancelActiveRealtimeResponse(
  state: AiRealtimeProtocolState,
): AiRealtimeProtocolState {
  if (state.phase !== "thinking") return state;
  return {
    ...state,
    phase: "listening",
    responseComplete: false,
    activeTool: undefined,
    retiredResponseIds: retireId(
      state.retiredResponseIds,
      state.activeResponseId,
    ),
    error: undefined,
  };
}

function isRetired(ids: readonly string[], id: string | undefined): boolean {
  return Boolean(id && ids.includes(id));
}

function acceptsUserItem(
  state: AiRealtimeProtocolState,
  itemId: string | undefined,
): boolean {
  if (!itemId) return true;
  if (isRetired(state.retiredUserItemIds, itemId)) return false;
  return !state.activeUserItemId || state.activeUserItemId === itemId;
}

function responseId(event: RealtimeServerEvent): string | undefined {
  return event.response_id ?? event.response?.id;
}

function acceptsResponse(
  state: AiRealtimeProtocolState,
  id: string | undefined,
): boolean {
  if (!id) return true;
  if (isRetired(state.retiredResponseIds, id)) return false;
  return !state.activeResponseId || state.activeResponseId === id;
}

function updateArchivedTurn(
  state: AiRealtimeProtocolState,
  key: keyof AiConversationTurnRef,
  id: string | undefined,
  update: (turn: AiConversationTurn) => AiConversationTurn,
): ConversationTimeline {
  if (!id) return { turns: state.turns, turnRefs: state.turnRefs };
  const index = state.turnRefs.findIndex((ref) => ref[key] === id);
  if (index < 0) return { turns: state.turns, turnRefs: state.turnRefs };
  return boundTimeline(
    state.turns.map((turn, turnIndex) => (
      turnIndex === index ? update(turn) : turn
    )),
    state.turnRefs,
  );
}

export function reduceRealtimeServerEvent(
  state: AiRealtimeProtocolState,
  event: RealtimeServerEvent,
): AiRealtimeProtocolState {
  switch (event.type) {
    case "session.created":
    case "session.updated":
      return {
        ...state,
        phase: "listening",
        responseComplete: false,
        error: undefined,
      };
    case "input_audio_buffer.speech_started": {
      const archived = archiveCurrentTurn(state);
      return {
        ...state,
        phase: "listening",
        turns: archived.turns,
        turnRefs: archived.turnRefs,
        userText: "",
        assistantText: "",
        activeUserItemId: event.item_id,
        activeResponseId: undefined,
        activeTool: undefined,
        responseComplete: false,
        retiredUserItemIds: retireId(
          state.retiredUserItemIds,
          state.activeUserItemId,
        ),
        retiredResponseIds: retireId(
          state.retiredResponseIds,
          state.activeResponseId,
        ),
        error: undefined,
      };
    }
    case "input_audio_buffer.speech_stopped":
      return { ...state, phase: "thinking", responseComplete: false };
    case "response.created": {
      const id = responseId(event);
      if (!acceptsResponse(state, id)) return state;
      return {
        ...state,
        phase: "thinking",
        responseComplete: false,
        activeResponseId: id ?? state.activeResponseId,
      };
    }
    case "conversation.item.input_audio_transcription.delta": {
      if (isRetired(state.retiredUserItemIds, event.item_id)) {
        const timeline = updateArchivedTurn(
          state,
          "userItemId",
          event.item_id,
          (turn) => ({
            ...turn,
            user: boundedText(turn.user + (event.delta ?? "")),
          }),
        );
        return {
          ...state,
          ...timeline,
        };
      }
      if (!acceptsUserItem(state, event.item_id)) return state;
      return {
        ...state,
        activeUserItemId: event.item_id ?? state.activeUserItemId,
        userText: boundedText(state.userText + (event.delta ?? "")),
      };
    }
    case "conversation.item.input_audio_transcription.completed": {
      const usage = usageFromTranscription(event);
      const charge = priceTranscriptionUsage({
        model: state.transcriptionModel ?? "gpt-4o-mini-transcribe",
        audioInputTokens: usage.transcriptionAudioInputTokens,
        textOutputTokens: usage.transcriptionTextOutputTokens,
      });
      if (isRetired(state.retiredUserItemIds, event.item_id)) {
        const timeline = updateArchivedTurn(
          state,
          "userItemId",
          event.item_id,
          (turn) => ({
            ...turn,
            user: boundedText(event.transcript ?? turn.user),
          }),
        );
        return {
          ...state,
          ...timeline,
          usage: addAiUsage(state.usage, usage),
          charge: mergeAiUsageCharge(state.charge, charge),
        };
      }
      if (!acceptsUserItem(state, event.item_id)) return state;
      return {
        ...state,
        activeUserItemId: event.item_id ?? state.activeUserItemId,
        userText: boundedText(event.transcript ?? state.userText),
        ...(!event.transcript?.trim() && !state.activeResponseId ? { phase: "listening" as const } : {}),
        usage: addAiUsage(state.usage, usage),
        charge: mergeAiUsageCharge(state.charge, charge),
      };
    }
    case "response.output_text.delta":
    case "response.text.delta": {
      const id = responseId(event);
      if (isRetired(state.retiredResponseIds, id)) {
        const timeline = updateArchivedTurn(
          state,
          "responseId",
          id,
          (turn) => ({
            ...turn,
            assistant: boundedText(turn.assistant + (event.delta ?? "")),
          }),
        );
        return {
          ...state,
          ...timeline,
        };
      }
      if (!acceptsResponse(state, id)) return state;
      return {
        ...state,
        phase: "thinking",
        responseComplete: false,
        activeResponseId: id ?? state.activeResponseId,
        assistantText: boundedText(state.assistantText + (event.delta ?? "")),
      };
    }
    case "response.output_text.done": {
      const id = responseId(event);
      if (isRetired(state.retiredResponseIds, id)) {
        const timeline = updateArchivedTurn(
          state,
          "responseId",
          id,
          (turn) => ({
            ...turn,
            assistant: boundedText(event.text ?? turn.assistant),
          }),
        );
        return {
          ...state,
          ...timeline,
        };
      }
      if (!acceptsResponse(state, id)) return state;
      return {
        ...state,
        activeResponseId: id ?? state.activeResponseId,
        assistantText: boundedText(event.text ?? state.assistantText),
        phase: "listening",
      };
    }
    case "response.done": {
      const id = responseId(event);
      if (isRetired(state.retiredResponseIds, id)) {
        const usage = usageFromResponse(event);
        return {
          ...state,
          usage: addAiUsage(state.usage, usage),
          charge: mergeAiUsageCharge(state.charge, priceRealtimeUsage({
            model: state.model ?? "gpt-realtime",
            ...usage,
          })),
        };
      }
      if (!acceptsResponse(state, id)) return state;
      const usage = usageFromResponse(event);
      const failure = event.response?.status === "failed"
        ? boundedText(event.response.status_details?.error?.message ?? "Realtime response failed", 160)
        : undefined;
      return {
        ...state,
        phase: failure ? "error" : "listening",
        responseComplete: !failure,
        error: failure,
        activeTool: undefined,
        activeResponseId: id ?? state.activeResponseId,
        usage: addAiUsage(state.usage, usage),
        charge: mergeAiUsageCharge(state.charge, priceRealtimeUsage({
          model: state.model ?? "gpt-realtime",
          ...usage,
        })),
      };
    }
    case "conversation.item.input_audio_transcription.failed":
      if (isRetired(state.retiredUserItemIds, event.item_id)) return state;
    case "error":
      return {
        ...state,
        phase: "error",
        responseComplete: false,
        activeTool: undefined,
        error: boundedText(event.error?.message ?? "Realtime session failed", 160),
      };
    default:
      return state;
  }
}

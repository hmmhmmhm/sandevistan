import type {
  AudioInputSource,
  EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import type { AiWebSearchResult } from "./ai-tools";
import type { AiRealtimeProtocolState } from "./ai-realtime-protocol";
import type { RealtimeSocket } from "./ai-realtime-transport";
import type { createSonioxRealtimeSession } from "./soniox-realtime-session";
import type { DataState, LocationValue } from "./live-state";
import type { McpServerConfig } from "./mcp-servers";
import type { PhoneLocale } from "./phone-types";

type AudioBridge = {
  audioControl(
    isOpen: boolean,
    source?: AudioInputSource,
  ): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

export type AiRealtimeSession = {
  start(): Promise<void>;
  approvePendingMcp?(): boolean;
  cancelResponse(): AiRealtimeProtocolState;
  stop(): Promise<AiRealtimeProtocolState>;
  getState(): AiRealtimeProtocolState;
};

export type AiRealtimeSessionOptions = {
  readonly bridge: AudioBridge;
  readonly key: string;
  readonly sonioxKey?: string;
  readonly locale: PhoneLocale;
  readonly getLocation?: () => DataState<LocationValue>;
  readonly mcpServers?: readonly McpServerConfig[];
  readonly now?: () => Date;
  readonly searchWeb?: (
    query: string,
    locale: PhoneLocale,
    signal: AbortSignal,
  ) => Promise<AiWebSearchResult>;
  readonly fetchImpl?: typeof fetch;
  readonly createSocket?: (
    url: string,
    protocols: string[],
  ) => RealtimeSocket;
  readonly createSonioxSession?: typeof createSonioxRealtimeSession;
  readonly onState?: (
    state: AiRealtimeProtocolState,
    eventType?: string,
  ) => void;
};

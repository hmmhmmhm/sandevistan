import {
  executeBuiltinAiTool,
  type AiCitationSource,
  type AiWebSearchResult,
} from "./ai-tools";
import type { DataState, LocationValue } from "./live-state";
import type { McpServerConfig } from "./mcp-servers";
import type { PhoneLocale } from "./phone-types";

type FunctionCall = {
  readonly callId: string;
  readonly name: string;
  readonly arguments: string;
};

export type AiToolKind = "time" | "location" | "weather" | "web-search" | "mcp" | "generic";

export type AiActiveTool = {
  readonly id: string;
  readonly kind: AiToolKind;
  readonly displayName?: string;
};

export type AiToolLifecycleUpdate =
  | { readonly activeTool: AiActiveTool }
  | { readonly clearId: string };

export type AiMcpApproval = {
  readonly id: string;
  readonly serverLabel: string;
  readonly serverName: string;
  readonly toolName: string;
  readonly argumentsSummary: string;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

function boundedIdentifier(value: unknown, maximum = 128): string | undefined {
  return typeof value === "string" && value.length > 0
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maximum)
    : undefined;
}

function builtinToolKind(name: string): AiToolKind {
  if (name === "get_weather") return "weather";
  if (name === "get_current_time") return "time";
  if (name === "get_current_location") return "location";
  if (name === "search_web") return "web-search";
  return "generic";
}

export function mcpToolLifecycleUpdate(
  event: unknown,
): AiToolLifecycleUpdate | undefined {
  const envelope = record(event);
  if (!envelope) return undefined;
  const type = envelope?.type;
  if (type === "response.mcp_call.in_progress") {
    const id = boundedIdentifier(envelope.item_id ?? envelope.call_id);
    if (!id) return undefined;
    return {
      activeTool: {
        id,
        kind: "mcp",
        displayName: boundedIdentifier(envelope.name, 96),
      },
    };
  }
  if (type === "response.output_item.done") {
    const item = record(envelope.item);
    const id = item?.type === "mcp_call"
      ? boundedIdentifier(item.id ?? item.call_id)
      : undefined;
    return id ? { clearId: id } : undefined;
  }
  if (type === "response.mcp_call.failed") {
    const id = boundedIdentifier(envelope.item_id ?? envelope.call_id);
    return id ? { clearId: id } : undefined;
  }
  return undefined;
}

export function responseFunctionCalls(event: unknown): readonly FunctionCall[] {
  const response = record(record(event)?.response);
  if (!Array.isArray(response?.output)) return [];
  return response.output.flatMap((value) => {
    const item = record(value);
    return item?.type === "function_call"
      && typeof item.call_id === "string"
      && typeof item.name === "string"
      && typeof item.arguments === "string"
      ? [{
          callId: item.call_id.slice(0, 128),
          name: item.name.slice(0, 96),
          arguments: item.arguments,
        }]
      : [];
  });
}

export function mcpApprovalRequest(
  event: unknown,
  servers: readonly McpServerConfig[],
): AiMcpApproval | undefined {
  const envelope = record(event);
  if (envelope?.type !== "conversation.item.done") return undefined;
  const item = record(envelope.item);
  if (
    item?.type !== "mcp_approval_request"
    || typeof item.id !== "string"
    || typeof item.server_label !== "string"
    || typeof item.name !== "string"
  ) return undefined;
  const match = servers.find(({ id }) => `mcp_${id}` === item.server_label);
  return {
    id: item.id.slice(0, 128),
    serverLabel: item.server_label.slice(0, 80),
    serverName: match?.name ?? item.server_label.slice(0, 80),
    toolName: item.name.slice(0, 96),
    argumentsSummary: typeof item.arguments === "string"
      ? item.arguments.replace(/\s+/g, " ").trim().slice(0, 180)
      : "{}",
  };
}

export function mcpApprovalResponse(id: string, approve: boolean) {
  return {
    type: "conversation.item.create" as const,
    item: {
      type: "mcp_approval_response" as const,
      approval_request_id: id,
      approve,
    },
  };
}

export function createAiRealtimeToolRunner(options: {
  readonly fetchImpl?: typeof fetch;
  readonly locale: PhoneLocale;
  readonly now: () => Date;
  readonly getLocation: () => DataState<LocationValue>;
  readonly searchWeb: (
    query: string,
    locale: PhoneLocale,
    signal: AbortSignal,
  ) => Promise<AiWebSearchResult>;
  readonly send: (event: unknown) => void;
  readonly onSources: (sources: readonly AiCitationSource[]) => void;
  readonly onSearchUsage: (usage: {
    readonly model: string;
    readonly inputTokens: number;
    readonly cachedInputTokens: number;
    readonly outputTokens: number;
    readonly webSearchCalls: number;
  }) => void;
  readonly onActiveTool: (activeTool: AiActiveTool | undefined) => void;
}) {
  const completed = new Set<string>();
  const activeCalls = new Map<string, AiActiveTool>();
  let active: AbortController | undefined;

  const publishActive = () => {
    options.onActiveTool(activeCalls.values().next().value);
  };

  return {
    handle(event: unknown, beforeStart?: () => void): boolean {
      const calls = responseFunctionCalls(event).filter(({ callId }) => (
        !completed.has(callId)
      ));
      if (calls.length === 0 || active) return false;
      const controller = new AbortController();
      active = controller;
      for (const call of calls) completed.add(call.callId);
      beforeStart?.();
      void Promise.all(calls.map(async (call) => {
        activeCalls.set(call.callId, {
          id: call.callId,
          kind: builtinToolKind(call.name),
        });
        publishActive();
        try {
          const result = await executeBuiltinAiTool(call.name, call.arguments, {
            locale: options.locale,
            fetchImpl: options.fetchImpl, signal: controller.signal,
            now: options.now,
            getLocation: options.getLocation,
            searchWeb: (query, locale) => options.searchWeb(
              query,
              locale,
              controller.signal,
            ),
          });
          if (controller.signal.aborted) return;
          if (result.ok && result.sources?.length) {
            options.onSources(result.sources);
          }
          if (result.ok && result.usage) options.onSearchUsage(result.usage);
          options.send({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: call.callId,
              output: JSON.stringify(result),
            },
          });
        } finally {
          activeCalls.delete(call.callId);
          publishActive();
        }
      })).then(() => {
        if (!controller.signal.aborted) options.send({ type: "response.create" });
      }).finally(() => {
        if (active === controller) active = undefined;
      });
      return true;
    },
    cancel() {
      active?.abort();
      active = undefined;
      activeCalls.clear();
      publishActive();
    },
  };
}

import { CUSTOM_MCP_AVAILABLE } from "./mcp-capabilities";
import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";

const MAX_SERVERS = 6;
const MAX_ENABLED_SERVERS = 3;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const SAFE_TOOL = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,95}$/;

export type McpServerConfig = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly authorization?: string;
  readonly allowedTools: readonly string[];
  readonly enabled: boolean;
};

export type McpServerValidation =
  | { readonly ok: true; readonly value: McpServerConfig }
  | { readonly ok: false; readonly code: string };

export function validateMcpServer(value: unknown): McpServerValidation {
  if (typeof value !== "object" || value === null) {
    return { ok: false, code: "format" };
  }
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
  const authorization = typeof item.authorization === "string"
    ? item.authorization.trim()
    : undefined;
  if (!SAFE_ID.test(id)) return { ok: false, code: "id" };
  if (!name || name.length > 80 || CONTROL_CHARACTERS.test(name)) {
    return { ok: false, code: "name" };
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, code: "url" };
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || rawUrl.length > 2_048
  ) {
    return { ok: false, code: "url" };
  }
  if (
    authorization
    && (authorization.length > 4_096 || CONTROL_CHARACTERS.test(authorization))
  ) {
    return { ok: false, code: "authorization" };
  }
  if (
    !Array.isArray(item.allowedTools)
    || item.allowedTools.length > 24
    || !item.allowedTools.every((tool) => (
      typeof tool === "string" && SAFE_TOOL.test(tool)
    ))
    || typeof item.enabled !== "boolean"
  ) {
    return { ok: false, code: "tools" };
  }
  return {
    ok: true,
    value: {
      id,
      name,
      url: url.toString(),
      ...(authorization ? { authorization } : {}),
      allowedTools: [...new Set(item.allowedTools as string[])],
      enabled: item.enabled,
    },
  };
}

function isMcpServers(value: unknown): value is readonly McpServerConfig[] {
  if (!Array.isArray(value) || value.length > MAX_SERVERS) return false;
  const valid = value.map(validateMcpServer);
  return valid.every((result) => result.ok)
    && value.filter((server) => server.enabled).length <= MAX_ENABLED_SERVERS;
}

export async function resolveMcpServers(
  storage: EvenStorage,
): Promise<readonly McpServerConfig[]> {
  if (!CUSTOM_MCP_AVAILABLE) return [];
  return await readCache(storage, "mcp-servers", isMcpServers) ?? [];
}

export function writeMcpServers(
  storage: EvenStorage,
  servers: readonly McpServerConfig[],
): Promise<boolean> {
  if (!isMcpServers(servers)) return Promise.resolve(false);
  return writeCache(storage, "mcp-servers", servers);
}

export function clearMcpServers(storage: EvenStorage): Promise<boolean> {
  return clearCache(storage, "mcp-servers");
}

export function maskMcpAuthorization(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) return "••••••••";
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

export function projectRealtimeMcpTools(
  servers: readonly McpServerConfig[],
) {
  return servers.filter((server) => server.enabled).map((server) => ({
    type: "mcp" as const,
    server_label: `mcp_${server.id}`,
    server_url: server.url,
    ...(server.authorization ? { authorization: server.authorization } : {}),
    ...(server.allowedTools.length > 0
      ? { allowed_tools: server.allowedTools }
      : {}),
    require_approval: "always" as const,
    server_description: server.name,
  }));
}

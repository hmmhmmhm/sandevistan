import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";

export const DEFAULT_X_RELAY_URL = "https://sandevistan-x-relay.hmmhmmhm.workers.dev";

export type XOAuthConfig = {
  readonly clientId: string;
  readonly redirectUri: string;
};

export type XOAuthTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
};

export type XOAuthPending = { readonly state: string; readonly codeVerifier: string };

const isValid = (value: string) => (
  value.trim().length >= 20
  && value.trim().length <= 4096
  && !/[\u0000-\u001f\u007f]/.test(value)
);

const isValidRelayUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && url.hostname.endsWith(".workers.dev")
      && (url.pathname === "/" || url.pathname === "")
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
};

export const validateXAccessToken = (value: string) => isValid(value)
  ? { ok: true as const, value: value.trim() }
  : { ok: false as const };

export const maskXAccessToken = (value: string) => (
  `${value.slice(0, 4)}••••${value.slice(-4)}`
);

export const resolveXAccessToken = (storage: EvenStorage) => (
  readCache(storage, "x-access-token", (value): value is string => (
    typeof value === "string" && isValid(value)
  ))
);

export const writeXAccessToken = (storage: EvenStorage, value: string) => {
  const validated = validateXAccessToken(value);
  return validated.ok
    ? writeCache(storage, "x-access-token", validated.value)
    : Promise.resolve(false);
};

export const clearXAccessToken = (storage: EvenStorage) => (
  clearCache(storage, "x-access-token")
);

const validClientId = (value: string) => value.trim().length >= 8
  && value.trim().length <= 512
  && !/[\u0000-\u001f\u007f]/.test(value);

const validRedirectUri = (value: string) => {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.hostname === "localhost")
      && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
};

export const validateXOAuthConfig = (clientId: string, redirectUri: string) => (
  validClientId(clientId) && validRedirectUri(redirectUri)
    ? { ok: true as const, value: { clientId: clientId.trim(), redirectUri: redirectUri.trim() } }
    : { ok: false as const }
);

export const resolveXOAuthConfig = (storage: EvenStorage) => readCache(
  storage,
  "x-oauth-config",
  (value): value is XOAuthConfig => typeof value === "object" && value !== null
    && "clientId" in value && "redirectUri" in value
    && typeof value.clientId === "string" && typeof value.redirectUri === "string"
    && validClientId(value.clientId) && validRedirectUri(value.redirectUri),
);

export const writeXOAuthConfig = (storage: EvenStorage, value: XOAuthConfig) =>
  writeCache(storage, "x-oauth-config", value);

export const clearXOAuthConfig = (storage: EvenStorage) => clearCache(storage, "x-oauth-config");

export const resolveXOAuthTokens = (storage: EvenStorage) => readCache(
  storage,
  "x-oauth-tokens",
  (value): value is XOAuthTokens => typeof value === "object" && value !== null
    && "accessToken" in value && "refreshToken" in value && "expiresAt" in value
    && typeof value.accessToken === "string" && typeof value.refreshToken === "string"
    && typeof value.expiresAt === "number" && isValid(value.accessToken)
    && isValid(value.refreshToken) && Number.isFinite(value.expiresAt),
);

export const writeXOAuthTokens = (storage: EvenStorage, value: XOAuthTokens) =>
  writeCache(storage, "x-oauth-tokens", value);

export const clearXOAuthTokens = (storage: EvenStorage) => clearCache(storage, "x-oauth-tokens");

export const resolveXOAuthPending = (storage: EvenStorage) => readCache(
  storage,
  "x-oauth-pending",
  (value): value is XOAuthPending => typeof value === "object" && value !== null
    && "state" in value && "codeVerifier" in value
    && typeof value.state === "string" && typeof value.codeVerifier === "string"
    && value.state.length >= 20 && value.codeVerifier.length >= 20,
);

export const writeXOAuthPending = (storage: EvenStorage, value: XOAuthPending) =>
  writeCache(storage, "x-oauth-pending", value);

export const clearXOAuthPending = (storage: EvenStorage) => clearCache(storage, "x-oauth-pending");

export const validateXRelayUrl = (value: string) => isValidRelayUrl(value)
  ? { ok: true as const, value: value.trim().replace(/\/$/, "") }
  : { ok: false as const };

export const resolveXRelayUrl = (storage: EvenStorage) => (
  readCache(storage, "x-relay-url", (value): value is string => (
    typeof value === "string" && isValidRelayUrl(value)
  )).then((value) => value ?? DEFAULT_X_RELAY_URL)
);

export const writeXRelayUrl = (storage: EvenStorage, value: string) => {
  const validated = validateXRelayUrl(value);
  return validated.ok
    ? writeCache(storage, "x-relay-url", validated.value)
    : Promise.resolve(false);
};

export const clearXRelayUrl = (storage: EvenStorage) => (
  clearCache(storage, "x-relay-url")
);

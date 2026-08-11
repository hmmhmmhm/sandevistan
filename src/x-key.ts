import {
  clearCache,
  readCache,
  writeCache,
  type EvenStorage,
} from "./live-cache";

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

export const validateXRelayUrl = (value: string) => isValidRelayUrl(value)
  ? { ok: true as const, value: value.trim().replace(/\/$/, "") }
  : { ok: false as const };

export const resolveXRelayUrl = (storage: EvenStorage) => (
  readCache(storage, "x-relay-url", (value): value is string => (
    typeof value === "string" && isValidRelayUrl(value)
  ))
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

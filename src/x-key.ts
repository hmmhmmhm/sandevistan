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

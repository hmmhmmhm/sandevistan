import { clearCache, readCache, writeCache, type EvenStorage } from "./live-cache";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export type SonioxKeyValidation =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly code: "empty" | "length" | "characters" };

export function validateSonioxKey(value: string): SonioxKeyValidation {
  const normalized = value.trim();
  if (!normalized) return { ok: false, code: "empty" };
  if (normalized.length < 16 || normalized.length > 4_096) return { ok: false, code: "length" };
  if (CONTROL_CHARACTERS.test(normalized)) return { ok: false, code: "characters" };
  return { ok: true, value: normalized };
}

function isStoredSonioxKey(value: unknown): value is string {
  return typeof value === "string" && validateSonioxKey(value).ok;
}

export function maskSonioxKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 8) return "••••••••";
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

export function resolveSonioxKey(storage: EvenStorage): Promise<string | undefined> {
  return readCache(storage, "soniox-key", isStoredSonioxKey);
}

export async function writeSonioxKey(storage: EvenStorage, value: string): Promise<boolean> {
  const validation = validateSonioxKey(value);
  return validation.ok && writeCache(storage, "soniox-key", validation.value);
}

export function clearSonioxKey(storage: EvenStorage): Promise<boolean> {
  return clearCache(storage, "soniox-key");
}

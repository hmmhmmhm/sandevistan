import type { ConversateCopilotRecord, ConversateDirectory } from "./conversate-history";
import type { RecordingTime } from "./ai-session-clock";
import { clearCache, readCache, writeCache, type EvenStorage } from "./live-cache";

export type ConversateSettings = {
  readonly transcription: boolean;
  readonly translation: boolean;
  readonly inform: boolean;
  readonly prepNote: boolean;
  readonly prepNoteText: string;
  readonly spokenLanguages: string;
  readonly transcriptionKeywords: string;
  readonly copilot: boolean;
  readonly goal: string;
  readonly informSeconds: number;
};

export type ConversateSegment = {
  readonly id: string;
  readonly text: string;
  readonly translation?: string;
  readonly language?: string;
  readonly at: string;
};

export type ConversateInform = {
  readonly expiresAt?: number;
  readonly id: string;
  readonly text: string;
  readonly at: string;
};

export type ConversateSuggestion = {
  readonly original: string;
  readonly pronunciation: string;
  readonly meaning: string;
  readonly style: string;
};

export type ConversateRecord = {
  readonly copilotHistory?: readonly ConversateCopilotRecord[];
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly segments: readonly ConversateSegment[];
  readonly informs: readonly ConversateInform[];
};

export type ConversateSnapshot = {
  readonly copilotHistory?: readonly ConversateCopilotRecord[];
  readonly directory?: ConversateDirectory;
  readonly activeCopilotId?: string;
  readonly copilotExpiresAt?: number;
  readonly partialItemId?: string;
  readonly transcriptAnchor?: string;
  readonly recording?: RecordingTime;
  readonly phase: "idle" | "connecting" | "listening" | "error";
  readonly partial: string;
  readonly segments: readonly ConversateSegment[];
  readonly informs: readonly ConversateInform[];
  readonly activeInform?: ConversateInform;
  readonly suggestions: readonly ConversateSuggestion[];
  readonly selectedSuggestion: number;
  readonly copilotOpen: boolean;
  readonly transcriptOffset: number;
  readonly informHistoryOpen: boolean;
  readonly selectedInform: number;
  readonly history: readonly ConversateRecord[];
  readonly error?: string;
};

export const DEFAULT_CONVERSATE_SETTINGS: ConversateSettings = {
  transcription: true,
  translation: true,
  inform: true,
  prepNote: true,
  prepNoteText: "",
  spokenLanguages: "",
  transcriptionKeywords: "",
  copilot: true,
  goal: "",
  informSeconds: 10,
};

const bounded = (value: string, length: number) => value.trim().slice(0, length);
const record = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

export function normalizeConversateSettings(value: Partial<ConversateSettings>): ConversateSettings {
  return {
    transcription: true,
    translation: value.translation !== false,
    inform: value.inform !== false,
    prepNote: value.prepNote !== false,
    prepNoteText: bounded(typeof value.prepNoteText === "string" ? value.prepNoteText : "", 2_000),
    spokenLanguages: bounded(typeof value.spokenLanguages === "string" ? value.spokenLanguages : "", 120),
    transcriptionKeywords: bounded(
      typeof value.transcriptionKeywords === "string" ? value.transcriptionKeywords : "",
      1_000,
    ),
    copilot: value.copilot !== false,
    goal: bounded(typeof value.goal === "string" ? value.goal : "", 500),
    informSeconds: Math.min(60, Math.max(3, Math.round(value.informSeconds ?? 10))),
  };
}

function isSettings(value: unknown): value is ConversateSettings {
  return record(value)
    && ["transcription", "translation", "inform", "prepNote", "copilot"]
      .every((key) => typeof value[key] === "boolean")
    && typeof value.prepNoteText === "string"
    && (value.spokenLanguages === undefined || typeof value.spokenLanguages === "string")
    && (value.transcriptionKeywords === undefined || typeof value.transcriptionKeywords === "string")
    && typeof value.goal === "string"
    && typeof value.informSeconds === "number";
}

function validCopilotHistory(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(item => record(item)
    && typeof item.id === "string" && typeof item.at === "string"
    && Array.isArray(item.suggestions) && item.suggestions.every(suggestion => record(suggestion)
      && ["original","pronunciation","meaning","style"].every(key => typeof suggestion[key] === "string"))));
}

function isHistory(value: unknown): value is readonly ConversateRecord[] {
  return Array.isArray(value) && value.every((item) => record(item)
    && typeof item.id === "string"
    && typeof item.startedAt === "string"
    && typeof item.endedAt === "string"
    && Array.isArray(item.segments)
    && Array.isArray(item.informs) && validCopilotHistory(item.copilotHistory));
}

export function createConversateSnapshot(
  history: readonly ConversateRecord[] = [],
): ConversateSnapshot {
  return {
    phase: "idle",
    partial: "",
    segments: [],
    informs: [],
    suggestions: [],
    selectedSuggestion: 0,
    copilotOpen: false,
    transcriptOffset: 0,
    informHistoryOpen: false,
    selectedInform: 0,
    history: history.slice(0, 20),
  };
}

export async function resolveConversateSettings(storage: EvenStorage) {
  const value = await readCache(storage, "conversate-settings", isSettings);
  return normalizeConversateSettings(value ?? DEFAULT_CONVERSATE_SETTINGS);
}

export function writeConversateSettings(storage: EvenStorage, value: ConversateSettings) {
  return writeCache(storage, "conversate-settings", normalizeConversateSettings(value));
}

export async function resolveConversateHistory(storage: EvenStorage) {
  return (await readCache(storage, "conversate-history", isHistory) ?? []).slice(0, 20);
}

export function writeConversateHistory(storage: EvenStorage, value: readonly ConversateRecord[]) {
  return writeCache(storage, "conversate-history", value.slice(0, 20));
}

export function clearConversateHistory(storage: EvenStorage) {
  return clearCache(storage, "conversate-history");
}

import { createConversateCues } from "./conversate-cues";
import { tapConversateDirectory, scrollConversateDirectory } from "./conversate-history";
import { conversateTranscriptRows, scrollConversateTranscript, type ConversateTranscriptRow } from "./conversate-transcript-layout";
import { createRecordingClock } from "./ai-session-clock";
import { createConversateTranslations } from "./conversate-translations";
import { DEFAULT_OPENAI_MODELS } from "./openai-models";
import type { AudioInputSource, EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { requestConversateAnalysis } from "./conversate-analysis";
import { createConversateRealtimeSession } from "./conversate-realtime-session";
import {
  type ConversateInform,
  type ConversateSegment,
  type ConversateSettings,
  type ConversateSnapshot,
  resolveConversateHistory,
  writeConversateHistory,
} from "./conversate-state";
import type { EvenStorage } from "./live-cache";
import type { PhoneLocale } from "./phone-types";
import { logDiagnostic } from "./diagnostic-log";

type Bridge = EvenStorage & {
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

export type ConversateRuntime = {
  start(): Promise<boolean>;
  stop(): Promise<void>;
  tap(): void;
  scroll(delta: -1 | 1): void;
  dispose(): void;
};

const clamp = (value: number, count: number) => Math.min(
  Math.max(0, value),
  Math.max(0, count - 1),
);

function transcriptionHints(settings: ConversateSettings) {
  const languages = settings.spokenLanguages.toLowerCase().split(/[\s,;]+/)
    .filter((value, index, all) => /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(value)
      && all.indexOf(value) === index)
    .slice(0, 3);
  const keywords = settings.transcriptionKeywords
    .split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean).slice(0, 50);
  const prompt = [
    "Live human conversation. Transcribe faithfully in the languages spoken. Preserve code-switching, names, numbers, and dates. Do not translate.",
    settings.goal.trim() ? `Conversation goal: ${settings.goal.trim()}.` : "",
    settings.prepNote && settings.inform && settings.prepNoteText.trim()
      ? `Context: ${settings.prepNoteText.trim()}` : "",
  ].filter(Boolean).join(" ").slice(0, 2_500);
  return { languages, keywords, prompt };
}

export function createConversateRuntime(options: {
  readonly bridge: Bridge;
  readonly getKey: () => string | undefined;
  readonly getLocale: () => PhoneLocale;
  readonly getSettings: () => ConversateSettings;
  readonly getSnapshot: () => ConversateSnapshot;
  readonly onSnapshot: (snapshot: ConversateSnapshot) => void;
  readonly refresh: () => void | Promise<void>;
  readonly informLineCount?: (text: string) => number;
  readonly transcriptRows?: (snapshot: ConversateSnapshot) => readonly ConversateTranscriptRow[];
  readonly createSession?: typeof createConversateRealtimeSession;
}) : ConversateRuntime {
  let session: ReturnType<typeof createConversateRealtimeSession> | undefined;
  let models = DEFAULT_OPENAI_MODELS;
  let disposed = false;
  let epoch = 0;
  let stopping: Promise<void> | undefined;
  let startedAt = "";
  let analysisAbort: AbortController | undefined;
  let pendingAnalysis = false;
  let translations: ReturnType<typeof createConversateTranslations> | undefined;

  const clock = createRecordingClock(() => {
    if (!disposed) { options.onSnapshot({ ...options.getSnapshot(), recording: clock.get() }); void options.refresh(); }
  });
  const publish = (patch: Partial<ConversateSnapshot>) => {
    if (disposed) return;
    options.onSnapshot({ ...options.getSnapshot(), ...patch, recording: clock.get() });
    void options.refresh();
  };

  const cues = createConversateCues({ snapshot: options.getSnapshot, publish, seconds: () => options.getSettings().informSeconds });
  const analyzeLatest = async () => {
    if (disposed || !session) return;
    if (analysisAbort) {
      pendingAnalysis = true;
      return;
    }
    const key = options.getKey();
    if (!key) return;
    const settings = { ...options.getSettings(), translation: false };
    if (!settings.inform && !settings.copilot) return;
    const snapshot = options.getSnapshot();
    if (!snapshot.segments.length) return;
    const targetId = snapshot.segments.at(-1)?.id;
    if (!targetId) return;
    const targetText = snapshot.segments.at(-1)?.text;
    const informId = `${targetId}-inform`;
    logDiagnostic("LIVE", "Conversate analysis start");
    const controller = new AbortController();
    const owner = epoch;
    analysisAbort = controller;
    try {
      const result = await requestConversateAnalysis({
        key,
        locale: options.getLocale(),
        model: models.analysis,
        settings,
        segments: snapshot.segments,
        signal: controller.signal,
        onPartial: (partial) => {
          if (disposed || owner !== epoch || controller.signal.aborted) return;
          const current = options.getSnapshot();
          if (current.segments.find(s => s.id === targetId)?.text !== targetText) return;
          const segments = current.segments.map((segment) => segment.id === targetId
            ? { ...segment, ...(settings.translation && partial.translation
                ? { translation: partial.translation.slice(0, 500) } : {}) }
            : segment);
          const inform = settings.inform && partial.inform
            && current.segments.at(-1)?.id === targetId
            ? { id: informId, text: partial.inform.slice(0, 180), at: new Date().toISOString() }
            : undefined;
          publish({ segments });
          if (inform) cues.inform(inform, true);
        },
      });
      if (disposed || owner !== epoch || controller.signal.aborted) return;
      const current = options.getSnapshot();
      if (current.segments.find(s => s.id === targetId)?.text !== targetText) return;
      const segments = [...current.segments];
      const targetIndex = segments.findIndex(({ id }) => id === targetId);
      const target = segments[targetIndex];
      if (target) segments[targetIndex] = {
        ...target,
        language: result.language.slice(0, 24),
      };
      const inform: ConversateInform | undefined = settings.inform && result.inform?.trim()
        ? {
            id: informId,
            text: result.inform.trim().slice(0, 180),
            at: new Date().toISOString(),
          }
        : undefined;
      const isLatestTurn = current.segments.at(-1)?.id === targetId;
      const isLatest = isLatestTurn && !current.partial;
      publish({ segments });
      if (inform) cues.inform(inform, isLatestTurn);
      if (settings.copilot) cues.copilot(`${targetId}-copilot`, result.suggestions, isLatest);
      logDiagnostic("LIVE", `Conversate analysis complete · Inform ${inform ? "ready" : "empty"}`);
    } catch (error) {
      if (!controller.signal.aborted && !(error instanceof Error && error.name === "AbortError")) {
        logDiagnostic("ERROR", "Conversate analysis failed");
      }
    } finally {
      if (analysisAbort === controller) {
        analysisAbort = undefined;
        if (pendingAnalysis) {
          pendingAnalysis = false;
          void analyzeLatest();
        }
      }
    }
  };

  return {
    async start() {
      if (disposed || session || stopping) return false;
      const owner = ++epoch;
      const isCurrent = () => !disposed && owner === epoch;
      const key = options.getKey();
      if (!key) {
        publish({ phase: "error", error: "OpenAI key required" });
        return false;
      }
      translations?.dispose();
      translations = createConversateTranslations({
        segments: () => options.getSnapshot().segments,
        request: (_segment, context, signal, partial) => requestConversateAnalysis({
          key, model: models.analysis, locale: options.getLocale(), segments: context, signal,
          settings: { ...options.getSettings(), inform: false, copilot: false },
          onPartial: value => { if (value.translation) partial(value.translation); },
        }),
        apply: (source, translation, language) => {
          if (!isCurrent() || !options.getSettings().translation) return;
          publish({ segments: options.getSnapshot().segments.map(segment => segment.id === source.id && segment.text === source.text
            ? { ...segment, ...(translation ? { translation: translation.slice(0, 500) } : {}), ...(language ? { language } : {}) } : segment) });
        },
        failed: () => logDiagnostic("ERROR", "Conversate translation failed"),
      });
      cues.dispose();
      clock.reset();
      startedAt = new Date().toISOString();
      publish({
        phase: "connecting", partial: "", partialItemId: undefined, segments: [], informs: [],
        copilotHistory: [], activeCopilotId: undefined, copilotExpiresAt: undefined, directory: undefined, transcriptAnchor: undefined,
        activeInform: undefined, suggestions: [], selectedSuggestion: 0,
        copilotOpen: false, transcriptOffset: 0, error: undefined,
      });
      const settings = options.getSettings();
      const hints = transcriptionHints(settings);
      session = (options.createSession ?? createConversateRealtimeSession)({
        bridge: options.bridge,
        key,
        locale: options.getLocale(),
        ...hints,
        onModels: (selected) => { if (isCurrent()) models = selected; },
        onPartial: (itemId, text) => {
          if (!isCurrent()) return;
          publish({
            partial: text.slice(-500), partialItemId: itemId,
          });
        },
        onCompleted: (itemId, text) => {
          if (!isCurrent()) return;
          const current = options.getSnapshot();
          const segment: ConversateSegment = {
            id: itemId,
            text: text.slice(0, 500),
            at: new Date().toISOString(),
          };
          publish({
            ...(current.partialItemId && current.partialItemId !== itemId ? {} : { partial: "", partialItemId: undefined }),
            segments: current.segments.some(s => s.id === itemId) ? current.segments.map(s => s.id === itemId ? segment : s) : [...current.segments, segment].slice(-200),
            phase: "listening",
          });
          if (settings.translation) translations?.enqueue(segment);
          void analyzeLatest();
        },
        onRefined: (itemId, text) => {
          if (!isCurrent()) return;
          const current = options.getSnapshot();
          const index = current.segments.findIndex(({ id }) => id === itemId);
          if (index < 0 || current.segments[index]?.text === text) return;
          const segments = [...current.segments];
          const segment = segments[index];
          if (!segment) return;
          const refined = { ...segment, text: text.slice(0, 500), translation: undefined };
          segments[index] = refined;
          publish({ segments });
          if (settings.translation) translations?.enqueue(refined);
          void analyzeLatest();
        },
        onError: (error) => {
          if (isCurrent()) { clock.stop(); publish({ phase: "error", error }); }
        },
      });
      try {
        await session.start();
        if (!isCurrent()) return false;
        clock.start();
        publish({ phase: "listening", error: undefined });
        return true;
      } catch (error) {
        if (!isCurrent()) return false;
        const failed = session;
        session = undefined;
        await failed?.stop();
        publish({
          phase: "error",
          error: error instanceof Error ? error.message.slice(0, 160) : "Conversate failed",
        });
        return false;
      }
    },
    async stop() {
      if (stopping) return stopping;
      clock.reset();
      const active = session;
      if (!active) return;
      epoch += 1;
      session = undefined;
      pendingAnalysis = false;
      cues.dispose();
      translations?.dispose();
      analysisAbort?.abort();
      analysisAbort = undefined;
      stopping = Promise.resolve().then(async () => {
        try {
          await active.stop();
          const snapshot = options.getSnapshot();
          const history = await resolveConversateHistory(options.bridge);
          const nextHistory = options.getSettings().transcription && snapshot.segments.length
            ? [{
                id: `${Date.now()}-conversation`,
                startedAt: startedAt || new Date().toISOString(),
                endedAt: new Date().toISOString(),
                segments: snapshot.segments,
                informs: snapshot.informs,
                copilotHistory: snapshot.copilotHistory,
              }, ...history].slice(0, 20)
            : history;
          await writeConversateHistory(options.bridge, nextHistory);
          publish({
            phase: "idle", partial: "", history: nextHistory,
            activeInform: undefined, suggestions: [], copilotOpen: false,
            transcriptOffset: 0, informHistoryOpen: false, error: undefined,
          });
        } finally {
          stopping = undefined;
        }
      });
      return stopping;
    },
    tap() { publish(tapConversateDirectory(options.getSnapshot(),options.getSettings())); },
    scroll(delta) {
      const current = options.getSnapshot(), directory = current.directory;
      publish(directory ? scrollConversateDirectory(current, delta, options.getSettings(), directory.mode === "inform"
          ? options.informLineCount?.(current.informs.find(i => i.id === directory.id)?.text ?? "") : undefined)
        : scrollConversateTranscript(current, options.transcriptRows?.(current)
          ?? conversateTranscriptRows(current, options.getSettings().translation), delta));
    },
    dispose() {
      clock.reset();
      disposed = true;
      epoch += 1;
      pendingAnalysis = false;
      cues.dispose();
      translations?.dispose();
      analysisAbort?.abort();
      analysisAbort = undefined;
      void session?.stop();
      session = undefined;
    },
  };
}

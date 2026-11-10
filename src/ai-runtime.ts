import { createRecordingClock } from "./ai-session-clock";
import type { AudioInputSource, EvenHubEvent } from "@evenrealities/even_hub_sdk";
import {
  addDailyAiUsage,
  costSummaryForCurrentPeriod,
  resolveAiUsageLedger,
  writeAiUsageLedger,
} from "./ai-cost";
import {
  appendAiConversationExcerpt,
  resolveAiConversationHistory,
  writeAiConversationHistory,
} from "./ai-history";
import {
  type AiHudSnapshot,
  createAiHudSnapshot,
  updateAiHudProtocol,
} from "./ai-hud-state";
import { createAiRealtimeSession } from "./ai-realtime-session";
import type { AiRealtimeProtocolState } from "./ai-realtime-protocol";
import { createAiPresentationPacer } from "./ai-presentation-pacer";
import { createAiRefreshScheduler } from "./ai-refresh-scheduler";
import type { EvenStorage } from "./live-cache";
import type { DataState, LocationValue } from "./live-state";
import { resolveMcpServers } from "./mcp-servers";
import type { PhoneLocale } from "./phone-types";

type AiBridge = EvenStorage & {
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

export type AiRuntime = {
  start(): Promise<boolean>;
  hold?(pressed: boolean): void;
  interrupt(): Promise<void>;
  stop(): Promise<void>;
  dispose(): void;
};

export function createAiRuntime(options: {
  readonly bridge: AiBridge;
  readonly getKey: () => string | undefined;
  readonly getLocale: () => PhoneLocale;
  readonly getLocation?: () => DataState<LocationValue>;
  readonly getSnapshot: () => AiHudSnapshot;
  readonly onSnapshot: (snapshot: AiHudSnapshot) => void;
  readonly refresh: () => void | Promise<void>;
  readonly getPresentationIntervalMs?: () => number;
  readonly createSession?: typeof createAiRealtimeSession;
}): AiRuntime {
  let session: ReturnType<typeof createAiRealtimeSession> | undefined;
  let disposed = false;
  let epoch = 0;
  let stopping: Promise<void> | undefined;
  const scheduler = createAiRefreshScheduler(options.refresh, 100);

  const clock = createRecordingClock(() => {
    if (disposed) return;
    options.onSnapshot({ ...options.getSnapshot(), recording: clock.get() }); scheduler.request();
  });
  const publish = (
    snapshot: AiHudSnapshot,
    final = false,
    waitForPresentation = false,
  ) => {
    if (disposed) return;
    options.onSnapshot({ ...snapshot, recording: clock.get() });
    if (final || waitForPresentation) return scheduler.final();
    scheduler.request();
  };
  const pacer = createAiPresentationPacer({
    onFrame: publish,
    getIntervalMs: options.getPresentationIntervalMs,
    graphemesPerTick: Number.MAX_SAFE_INTEGER,
  });

  const persist = async (
    protocol: AiRealtimeProtocolState,
  ) => {
    const now = new Date();
    const currentTurn = {
      user: protocol.userText.trim(),
      assistant: protocol.assistantText.trim(),
    };
    const latestCompleted = [...protocol.turns].reverse().find(
      (turn) => turn.user.trim() || turn.assistant.trim(),
    );
    const excerpt = currentTurn.user || currentTurn.assistant
      ? currentTurn
      : latestCompleted;
    const [history, ledger] = await Promise.all([
      resolveAiConversationHistory(options.bridge),
      resolveAiUsageLedger(options.bridge),
    ]);
    const nextHistory = excerpt?.user || excerpt?.assistant
      ? appendAiConversationExcerpt(history, {
          id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
          endedAt: now.toISOString(),
          user: excerpt.user,
          assistant: excerpt.assistant,
          sources: protocol.sources,
        })
      : history;
    const nextLedger = addDailyAiUsage(
      ledger,
      now,
      protocol.usage,
      protocol.charge,
    );
    const costs = costSummaryForCurrentPeriod(nextLedger, now);
    await Promise.all([
      writeAiConversationHistory(options.bridge, nextHistory),
      writeAiUsageLedger(options.bridge, nextLedger),
    ]);
    publish(createAiHudSnapshot(
      Boolean(options.getKey()),
      nextHistory,
      costs.weekUsd,
      costs.monthUsd,
      costs.hasUnpricedUsage,
    ), true);
  };

  return {
    hold(pressed) {
      const active = session;
      if (!active?.capture) return;
      if (pressed) void active.capture.begin(); else active.capture.end();
    },
    async start() {
      if (disposed || session || stopping) return false;
      const owner = ++epoch;
      clock.reset();
      const key = options.getKey();
      if (!key) {
        publish({
          ...options.getSnapshot(),
          configured: false,
          phase: "unconfigured",
          error: "OpenAI key required",
        }, true);
        return false;
      }
      const mcpServers = await resolveMcpServers(options.bridge);
      if (disposed || session || stopping || owner !== epoch) return false;
      session = (options.createSession ?? createAiRealtimeSession)({
        bridge: options.bridge,
        captureMode: "hold",
        key,
        locale: options.getLocale(),
        getLocation: options.getLocation,
        mcpServers,
        onState: (protocol) => {
          if (disposed || owner !== epoch) return;
          if (protocol.captureState) {
            clock.watch();
            if (protocol.captureState === "recording") clock.resume(); else clock.pause();
          } else if (protocol.phase === "listening" && !clock.get()) clock.start();
          if (protocol.phase === "error" || protocol.phase === "idle") clock.stop();
          const snapshot = updateAiHudProtocol(
            options.getSnapshot(),
            protocol,
          );
          if (protocol.phase === "error") {
            pacer.reset();
            publish(snapshot, true);
          } else if (protocol.pendingApproval) {
            pacer.push(snapshot);
            void pacer.flush();
          } else {
            pacer.push(snapshot);
          }
        },
      });
      try {
        await session.start();
        return owner === epoch && !disposed;
      } catch {
        if (owner === epoch) session = undefined;
        return false;
      }
    },
    async interrupt() {
      const active = session;
      if (disposed || !active) return;
      if (active.approvePendingMcp?.()) return;
      const current = active.getState();
      const protocol = current.phase === "thinking"
        ? active.cancelResponse()
        : current;
      pacer.push(updateAiHudProtocol(options.getSnapshot(), protocol));
      await pacer.flush();
    },
    async stop() {
      if (stopping) return stopping;
      clock.reset();
      epoch += 1;
      pacer.reset();
      const active = session;
      session = undefined;
      if (!active) return;
      publish({ ...options.getSnapshot(), phase: "idle", activeTool: undefined,
        pendingApproval: undefined, responseComplete: false, canRevealFullResponse: false, error: undefined });
      stopping = Promise.resolve().then(async () => {
        try {
          const protocol = await active.stop();
          await persist(protocol);
        } finally { stopping = undefined; }
      });
      return stopping;
    },
    dispose() {
      clock.reset();
      disposed = true;
      epoch += 1;
      pacer.dispose();
      scheduler.dispose();
      const active = session;
      session = undefined;
      void active?.stop();
    },
  };
}

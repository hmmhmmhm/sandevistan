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
  interrupt(): Promise<void>;
  stop(): Promise<void>;
  dispose(): void;
};

export function createAiRuntime(options: {
  readonly bridge: AiBridge;
  readonly getKey: () => string | undefined;
  readonly getSonioxKey?: () => string | undefined;
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
  const scheduler = createAiRefreshScheduler(options.refresh, 100);

  const publish = (
    snapshot: AiHudSnapshot,
    final = false,
    waitForPresentation = false,
  ) => {
    if (disposed) return;
    options.onSnapshot(snapshot);
    if (final || waitForPresentation) return scheduler.final();
    scheduler.request();
  };
  const pacer = createAiPresentationPacer({
    onFrame: publish,
    getIntervalMs: options.getPresentationIntervalMs,
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
    async start() {
      if (disposed || session) return false;
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
      if (disposed || session) return false;
      session = (options.createSession ?? createAiRealtimeSession)({
        bridge: options.bridge,
        key,
        sonioxKey: options.getSonioxKey?.(),
        locale: options.getLocale(),
        getLocation: options.getLocation,
        mcpServers,
        onState: (protocol) => {
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
        return true;
      } catch {
        session = undefined;
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
      const active = session;
      session = undefined;
      if (!active) return;
      const protocol = await active.stop();
      pacer.reset();
      await persist(protocol);
    },
    dispose() {
      disposed = true;
      pacer.dispose();
      scheduler.dispose();
      const active = session;
      session = undefined;
      void active?.stop();
    },
  };
}

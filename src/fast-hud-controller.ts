import { createAiKeyLifecycle } from "./ai-key-lifecycle";
import { aiDetailLines } from "./fast-ai-detail-style";
import { conversateTranscriptRows } from "./conversate-transcript-layout";
import { useEffect } from "react";
import { drawDenseCanvasHud, getAdjacentHudPage, HUD_PAGES, type HudPage } from "./canvas-hud";
import { logDiagnostic, startDiagnosticHeartbeat, startWindowErrorDiagnostics } from "./diagnostic-log";
import { detailRefreshTarget } from "./fast-detail-refresh";
import { getAdjacentFastHudPage, normalizeFastHudPage, type FastHudPage } from "./fast-hud-pages";
import { FAST_MAP_ZOOM_RADII, createFastHudViewState, syncFastHudView } from "./fast-hud-view";
import { createFastHudInputController } from "./fast-hud-input-controller";
import { drawFastHudSurface, resolveFastHudViewContext, type FastHudNewsPageCache } from "./fast-hud-render";
import {
  transmitFastCanvas,
  type FastCanvasBattery,
  type FastCanvasRefreshRequest,
  type FastCanvasRefreshTarget,
} from "./glasses";
import { prepareInitialHud, transmitLegacyHud } from "./legacy-hud-controller";
import { createLiveDashboardSession } from "./live-dashboard";
import { createInitialLiveDashboardState, type LiveDashboardState } from "./live-state";
import { startMinuteRefresh } from "./minute-refresh";
import type { UseHudControllerOptions } from "./hud-controller-types";
import { resolvePhoneLocale } from "./phone-i18n";
import { getRoutingStatus } from "./routing";
import { createAiRuntime, type AiRuntime } from "./ai-runtime";
import { TRANSPORT_STATUS } from "./transport-status";
import { createConversateRuntime, type ConversateRuntime } from "./conversate-runtime";
import { prepareFastHudBridge, stopIdleSdkSensors, type FastHudBridge } from "./fast-hud-bootstrap";
type LiveSession = ReturnType<typeof createLiveDashboardSession>;
export function useHudController({
  autoStart, canvasRef, liveSessionRef, phonePreferencesRef, displayRefreshRef,
  companionOrsKeyRef, companionOpenAiKeyRef, aiKeyChangeRef, aiSnapshotRef,
  conversateSettingsRef, conversateSnapshotRef, displayHideStrategy,
  imageSendConcurrency, tileImageFormat, tilePaletteMode, modes, setStatus,
  setRoutingStatus, setCompanionRoute, setCompanionLive, setCompanionBattery,
  setCompanionStorage, setPhonePreferences, setCompanionAiSnapshot,
  setConversateSnapshot,
}: UseHudControllerOptions) {
  useEffect(() => {
    if (!autoStart || !canvasRef.current) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let liveSession: LiveSession | undefined;
    let aiRuntime: AiRuntime | undefined;
    let keyLifecycle: ReturnType<typeof createAiKeyLifecycle> | undefined;
    let conversateRuntime: ConversateRuntime | undefined;
    let bridge: FastHudBridge | undefined;
    let page: FastHudPage = HUD_PAGES[0];
    let view = createFastHudViewState();
    let battery: FastCanvasBattery | undefined;
    let live: LiveDashboardState = createInitialLiveDashboardState();
    let requestLiveRefresh: FastCanvasRefreshRequest | undefined;
    let stopMinuteRefresh: (() => void) | undefined;
    let lastSuccessfulDisplayMinute: number | undefined;
    let lastMinuteAttempt: number | undefined;
    let stopDiagnosticHeartbeat: (() => void) | undefined;
    let stopWindowErrorDiagnostics: (() => void) | undefined;
    let newsPageCache: FastHudNewsPageCache = { key: "", counts: [] };
    const canvas = canvasRef.current;
    if (modes.fastCanvas) {
      logDiagnostic("APP", "fast HUD effect start");
      stopDiagnosticHeartbeat = startDiagnosticHeartbeat();
      stopWindowErrorDiagnostics = startWindowErrorDiagnostics();
    }
    const report = (message: string) => { if (!cancelled) setStatus(message); };
    const currentLocale = () => resolvePhoneLocale(
      phonePreferencesRef.current.locale,
      typeof navigator === "undefined" ? "en" : navigator.language,
    );
    const viewContext = () => {
      const resolved = resolveFastHudViewContext(
        canvas,
        live,
        currentLocale(),
        aiSnapshotRef.current,
        newsPageCache,
      );
      newsPageCache = resolved.cache;
      return resolved.context;
    };
    const currentMapRadius = () => FAST_MAP_ZOOM_RADII[view.zoomIndex];
    const drawCurrentPage = () => {
      if (modes.fastCanvas) {
        page = normalizeFastHudPage(
          page,
          live.route.status,
          phonePreferencesRef.current,
        );
        if (
          view.mode === "navigation"
          && live.route.status === "disabled"
        ) {
          view = { ...view, mode: "weather" };
        }
      }
      view = syncFastHudView(view, viewContext());
      if (modes.fastCanvas) {
        drawFastHudSurface({
          layout: phonePreferencesRef.current,
          canvas,
          page,
          view,
          live,
          battery,
          mapRadiusMeters: currentMapRadius(),
          ai: aiSnapshotRef.current,
          conversate: conversateSnapshotRef.current,
          conversateSettings: conversateSettingsRef.current,
          locale: currentLocale(),
        });
      } else {
        drawDenseCanvasHud(canvas, new Date(), page as HudPage);
      }
    };
    const handleFastInput = createFastHudInputController({
      getView: () => view,
      setView: (next) => { view = next; },
      getPage: () => page,
      getContext: viewContext,
      getLiveSession: () => liveSession,
      getAiRuntime: () => aiRuntime,
      getConversateRuntime: () => conversateRuntime,
      drawCurrentPage,
      log: (message) => logDiagnostic("INPUT", message),
    });
    const requestVisibleRefresh = (target: FastCanvasRefreshTarget) => {
      return requestLiveRefresh?.(target);
    };
    const navigateCanvas = async (direction: "next" | "previous") => {
      page = modes.fastCanvas
        ? getAdjacentFastHudPage(
            page,
            direction,
            live.route.status,
            phonePreferencesRef.current,
          )
        : getAdjacentHudPage(page as HudPage, direction);
      drawCurrentPage();
    };
    void (async () => {
      if (modes.fastCanvas) {
        bridge = await prepareFastHudBridge({ onPreferences: setPhonePreferences, onStorage: setCompanionStorage });
        if (cancelled) return;
      }
      await prepareInitialHud(canvas, modes, drawCurrentPage);
      report(TRANSPORT_STATUS.preparing);
      if (modes.fastCanvas) {
        logDiagnostic(
          "APP",
          `transport start · pipeline ${imageSendConcurrency}`
            + ` · palette ${tilePaletteMode}`
            + ` · format ${tileImageFormat}`
            + ` · hide ${displayHideStrategy}`,
        );
        const transportCleanup = await transmitFastCanvas(
          canvas,
          report,
          navigateCanvas,
          {
            beforeExternalRefresh: drawCurrentPage,
            beforeRestore: drawCurrentPage,
            displayHideStrategy,
            imageSendConcurrency,
            tileImageFormat,
            tilePaletteMode,
            onBattery: (nextBattery) => {
              battery = nextBattery;
              setCompanionBattery(nextBattery);
              logDiagnostic(
                "APP",
                nextBattery
                  ? `battery ${nextBattery.label}`
                    + ` · level ${nextBattery.level ?? "unknown"}`
                    + ` · charging ${nextBattery.charging ?? "unknown"}`
                  : "battery unavailable",
              );
              if (
                requestLiveRefresh
                && page === "overview"
                && view.mode === "dashboard"
              ) {
                requestVisibleRefresh("right-top");
              } else if (!requestLiveRefresh) {
                drawCurrentPage();
              }
            },
            onDisplayCommitted: (minute) => {
              lastSuccessfulDisplayMinute = minute;
              logDiagnostic(
                "REFRESH",
                `display committed · minute ${minute}`,
              );
            },
            canHandleBusyInput: input => (view.mode === "ai" || view.mode === "conversate")
              && (input === "scroll-next" || input === "scroll-previous"),
            onInput: handleFastInput,
            onRawEvent: (event) => {
              if (!event.hidden) return;
              const field = (value: number | undefined) => value ?? "-";
              report(TRANSPORT_STATUS.active);
              logDiagnostic(
                "INPUT",
                `hidden input #${event.count}`
                  + ` · SYS ${field(event.sysEventType)}`
                  + ` · TEXT ${field(event.textEventType)}`
                  + ` · SRC ${field(event.eventSource)}`,
              );
            },
            onRefreshReady: (request) => {
              if (cancelled) return;
              requestLiveRefresh = request;
              displayRefreshRef.current = () => {
                drawCurrentPage();
                requestVisibleRefresh("all");
              };
              logDiagnostic("APP", "transport refresh ready");
              stopMinuteRefresh ??= startMinuteRefresh((minute) => {
                if (lastMinuteAttempt === minute) return;
                lastMinuteAttempt = minute;
                if (view.mode !== "news") {
                  liveSession?.refreshNewsIfDue?.();
                } else {
                  logDiagnostic("LIVE", "news refill skipped · reading");
                }
                if (lastSuccessfulDisplayMinute === minute) {
                  logDiagnostic(
                    "TIMER",
                    "minute refresh skipped · already rendered",
                  );
                  return;
                }
                logDiagnostic(
                  "TIMER",
                  `minute refresh · mode ${view.mode}`,
                );
                if (view.mode === "dashboard") {
                  requestVisibleRefresh("right-top");
                }
              });
            },
          },
        );
        logDiagnostic("APP", "transport ready");
        if (cancelled) {
          logDiagnostic("APP", "transport ready after cleanup");
          transportCleanup();
          return;
        }
        unsubscribe = transportCleanup;
        logDiagnostic("APP", "live bridge wait");
        const activeBridge = bridge;
        if (!activeBridge) return;
        const nextRoutingStatus = await getRoutingStatus()
          .catch(() => ({ enabled: false }));
        if (cancelled) return;
        logDiagnostic(
          "APP",
          `live bridge ready · routing ${
            nextRoutingStatus.enabled ? "enabled" : "disabled"
          }`,
        );
        setRoutingStatus(nextRoutingStatus);
        setCompanionRoute(nextRoutingStatus.enabled
          ? { status: "fresh" }
          : { status: "disabled" });
        aiRuntime = createAiRuntime({
          bridge: activeBridge,
          getKey: () => companionOpenAiKeyRef.current,
          getLocale: currentLocale,
          getLocation: () => live.location,
          getSnapshot: () => aiSnapshotRef.current,
          getPresentationIntervalMs: () => (
            phonePreferencesRef.current.aiTextIntervalMs
          ),
          onSnapshot: (snapshot) => {
            aiSnapshotRef.current = snapshot;
            setCompanionAiSnapshot(snapshot);
            view = syncFastHudView(view, viewContext());
          },
          refresh: async () => {
            if (cancelled) return;
            drawCurrentPage();
            await requestVisibleRefresh(view.mode === "ai" || view.mode === "conversate" ? "all" : "right");
          },
        });
        conversateRuntime = createConversateRuntime({
          informLineCount: text => { const context = canvas.getContext("2d"); return context ? aiDetailLines(context,text,15,528,32).length : 4; },
          transcriptRows: snapshot => conversateTranscriptRows(snapshot, conversateSettingsRef.current.translation, canvas.getContext("2d") ?? undefined),
          bridge: activeBridge,
          getKey: () => companionOpenAiKeyRef.current,
          getLocale: currentLocale,
          getSettings: () => conversateSettingsRef.current,
          getSnapshot: () => conversateSnapshotRef.current,
          onSnapshot: (snapshot) => {
            conversateSnapshotRef.current = snapshot;
            setConversateSnapshot(snapshot);
          },
          refresh: async () => {
            if (cancelled) return;
            drawCurrentPage();
            await requestVisibleRefresh(view.mode === "ai" || view.mode === "conversate" ? "all" : "right");
          },
        });
        keyLifecycle = createAiKeyLifecycle({ getKey: () => companionOpenAiKeyRef.current, getMode: () => view.mode, ai: aiRuntime, conversate: conversateRuntime,
          onError: () => {
            const error = "AI configuration change failed";
            setCompanionAiSnapshot({ ...aiSnapshotRef.current, phase: "error", error });
            setConversateSnapshot({ ...conversateSnapshotRef.current, phase: "error", error });
            drawCurrentPage(); void requestVisibleRefresh("all");
          },
        });
        aiKeyChangeRef.current = keyLifecycle.changed;
        keyLifecycle.ready();
        liveSession = createLiveDashboardSession({
          bridge: activeBridge,
          routingStatus: nextRoutingStatus,
          canRefreshNews: () => view.mode !== "news",
          getLocale: currentLocale,
          onUpdate: (update) => {
            if (cancelled) return;
            const refreshTarget = detailRefreshTarget(
              view.mode,
              live,
              update.state,
              update.target,
            );
            logDiagnostic(
              "LIVE",
              `app update · ${update.target}`
                + ` · visible ${refreshTarget ?? "none"}`,
            );
            live = update.state;
            setCompanionLive(update.state);
            view = syncFastHudView(view, viewContext());
            setCompanionRoute(update.state.route);
            if (refreshTarget) requestVisibleRefresh(refreshTarget);
          },
        });
        liveSession.setRoutingKey?.(companionOrsKeyRef.current);
        liveSessionRef.current = liveSession;
        if (cancelled) {
          liveSession.dispose();
          if (liveSessionRef.current === liveSession) {
            liveSessionRef.current = undefined;
          }
          liveSession = undefined;
          return;
        }
        logDiagnostic("APP", "live session start");
        await liveSession.start();
        const startedState = liveSession.getState();
        if (startedState) {
          live = startedState;
          setCompanionLive(startedState);
        }
        logDiagnostic("APP", "live session ready");
        return;
      }
      unsubscribe = await transmitLegacyHud(
        canvas,
        modes,
        report,
        navigateCanvas,
      );
    })().catch((error: unknown) => {
      if (modes.fastCanvas) {
        logDiagnostic(
          "ERROR",
          `app startup failed · ${
            error instanceof Error ? error.name : typeof error
          }`,
        );
      }
      report(TRANSPORT_STATUS.error);
    });

    return () => {
      if (modes.fastCanvas) {
        logDiagnostic("APP", "fast HUD effect cleanup");
      }
      cancelled = true;
      keyLifecycle?.dispose();
      if (aiKeyChangeRef.current === keyLifecycle?.changed) aiKeyChangeRef.current = undefined;
      stopMinuteRefresh?.();
      displayRefreshRef.current = undefined;
      liveSession?.dispose();
      aiRuntime?.dispose();
      conversateRuntime?.dispose();
      if (bridge) void stopIdleSdkSensors(bridge);
      if (liveSessionRef.current === liveSession) {
        liveSessionRef.current = undefined;
      }
      unsubscribe?.();
      if (modes.fastCanvas) {
        stopWindowErrorDiagnostics?.();
        stopDiagnosticHeartbeat?.();
      }
    };
  }, [
    autoStart,
    canvasRef,
    companionOrsKeyRef,
    companionOpenAiKeyRef,
    aiKeyChangeRef,
    aiSnapshotRef,
    conversateSettingsRef,
    conversateSnapshotRef,
    displayHideStrategy,
    displayRefreshRef,
    imageSendConcurrency,
    tileImageFormat,
    tilePaletteMode,
    liveSessionRef,
    modes.calibration,
    modes.canvas,
    modes.diagnostic,
    modes.fastCanvas,
    modes.hardwareBmp,
    modes.hybrid,
    modes.layeredHybrid,
    modes.legacyCanvas,
    phonePreferencesRef,
    setCompanionBattery,
    setCompanionLive,
    setCompanionRoute,
    setCompanionStorage,
    setPhonePreferences,
    setCompanionAiSnapshot,
    setConversateSnapshot,
    setRoutingStatus,
    setStatus,
  ]);
}

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
  type FastCanvasNativeTextController,
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
import { createNativeAiTextContent } from "./native-ai-text";
import { TRANSPORT_STATUS } from "./transport-status";
import { createConversateRuntime, type ConversateRuntime } from "./conversate-runtime";
import { createNativeConversateContent } from "./native-conversate-text";
import { prepareFastHudBridge, stopIdleSdkSensors, type FastHudBridge } from "./fast-hud-bootstrap";
import type { SensorStatus } from "./phone-types";
type LiveSession = ReturnType<typeof createLiveDashboardSession>;

function createSensorAwareBridge(
  bridge: FastHudBridge,
  onSensors: (value: SensorStatus) => void,
  initialSensors: SensorStatus,
): FastHudBridge {
  let sensors = initialSensors;
  const update = (value: Partial<SensorStatus>) => {
    sensors = { ...sensors, ...value };
    onSensors(sensors);
  };

  return new Proxy(bridge, {
    get(target, property, receiver) {
      if (property === "audioControl") {
        return async (...args: Parameters<FastHudBridge["audioControl"]>) => {
          const success = await target.audioControl(...args);
          if (success) update({ microphone: args[0] ? "on" : "off" });
          return success;
        };
      }
      if (property === "imuControl") {
        return async (...args: Parameters<FastHudBridge["imuControl"]>) => {
          const success = await target.imuControl(...args);
          if (success) update({ imu: args[0] ? "on" : "off" });
          return success;
        };
      }
      if (property === "startAppLocationUpdates") {
        return async (...args: Parameters<FastHudBridge["startAppLocationUpdates"]>) => {
          const success = await target.startAppLocationUpdates(...args);
          if (success) update({ location: "on" });
          return success;
        };
      }
      if (property === "stopAppLocationUpdates") {
        return async () => {
          const success = await target.stopAppLocationUpdates();
          if (success) update({ location: "off" });
          return success;
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function useHudController({
  autoStart, canvasRef, liveSessionRef, phonePreferencesRef, displayRefreshRef,
  companionOrsKeyRef, companionOpenAiKeyRef, companionSonioxKeyRef, aiSnapshotRef,
  conversateSettingsRef, conversateSnapshotRef, displayHideStrategy,
  imageSendConcurrency, tileImageFormat, tilePaletteMode, modes, setStatus,
  setRoutingStatus, setCompanionRoute, setCompanionLive, setCompanionBattery,
  setCompanionStorage, setPhonePreferences, setCompanionAiSnapshot,
  setConversateSnapshot, setCompanionDisplayVisible, setCompanionSensors,
}: UseHudControllerOptions) {
  useEffect(() => {
    if (!autoStart || !canvasRef.current) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let liveSession: LiveSession | undefined;
    let aiRuntime: AiRuntime | undefined;
    let conversateRuntime: ConversateRuntime | undefined;
    let nativeAiText: FastCanvasNativeTextController | undefined;
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
    let sensorStatus: SensorStatus = {
      microphone: "unknown",
      location: "unknown",
      imu: "unknown",
    };
    const updateSensorStatus = (value: SensorStatus) => {
      sensorStatus = value;
      setCompanionSensors(value);
    };
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
          canvas,
          page,
          view,
          live,
          battery,
          mapRadiusMeters: currentMapRadius(),
          dashboardMapEnabled: phonePreferencesRef.current.dashboardMapEnabled,
          ai: aiSnapshotRef.current,
          conversate: conversateSnapshotRef.current,
          locale: currentLocale(),
        });
      } else {
        drawDenseCanvasHud(canvas, new Date(), page as HudPage);
      }
    };
    const nativeAiContent = () => createNativeAiTextContent(
      aiSnapshotRef.current,
      view.aiLine,
      currentLocale(),
    );
    const nativeConversateContent = () => createNativeConversateContent(
      conversateSnapshotRef.current,
      currentLocale(),
      conversateSettingsRef.current,
    );
    const handleFastInput = createFastHudInputController({
      getView: () => view,
      setView: (next) => { view = next; },
      getPage: () => page,
      getContext: viewContext,
      getLiveSession: () => liveSession,
      getAiRuntime: () => aiRuntime,
      getConversateRuntime: () => conversateRuntime,
      getNativeText: () => nativeAiText,
      nativeContent: nativeAiContent,
      conversateContent: nativeConversateContent,
      drawCurrentPage,
      log: (message) => logDiagnostic("INPUT", message),
    });
    const requestVisibleRefresh = (target: FastCanvasRefreshTarget) => {
      requestLiveRefresh?.(target);
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
        bridge = await prepareFastHudBridge({
          onPreferences: setPhonePreferences,
          onStorage: setCompanionStorage,
          onSensors: updateSensorStatus,
        });
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
            onDisplayVisibilityChange: setCompanionDisplayVisible,
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
            onNativeTextReady: (controller) => {
              nativeAiText = controller;
              logDiagnostic("APP", "native AI text ready");
            },
            onRefreshReady: (request) => {
              if (cancelled) return;
              requestLiveRefresh = request;
              displayRefreshRef.current = () => {
                if (view.mode === "ai" && nativeAiText?.active()) {
                  void nativeAiText.update(nativeAiContent());
                  return;
                }
                if (view.mode === "conversate" && nativeAiText?.active()) {
                  void nativeAiText.updateConversate?.(nativeConversateContent());
                  return;
                }
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
        const sensorAwareBridge = createSensorAwareBridge(
          activeBridge,
          updateSensorStatus,
          sensorStatus,
        );
        // The G2 host accepts sensor commands reliably only after its startup
        // page exists. Re-assert the idle state here so the Developer view has
        // a confirmed result instead of the pre-page bridge result.
        await stopIdleSdkSensors(sensorAwareBridge);
        if (cancelled) return;
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
          bridge: sensorAwareBridge,
          getKey: () => companionOpenAiKeyRef.current,
          getSonioxKey: () => companionSonioxKeyRef.current,
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
            if (view.mode === "ai" && nativeAiText?.active()) {
              await nativeAiText.update(nativeAiContent());
              return;
            }
            drawCurrentPage();
            requestVisibleRefresh("right");
          },
        });
        conversateRuntime = createConversateRuntime({
          bridge: sensorAwareBridge,
          getKey: () => companionOpenAiKeyRef.current,
          getSonioxKey: () => companionSonioxKeyRef.current,
          getLocale: currentLocale,
          getSettings: () => conversateSettingsRef.current,
          getSnapshot: () => conversateSnapshotRef.current,
          onSnapshot: (snapshot) => {
            conversateSnapshotRef.current = snapshot;
            setConversateSnapshot(snapshot);
          },
          refresh: async (priority) => {
            if (cancelled) return;
            if (view.mode === "conversate" && nativeAiText?.active()) {
              await nativeAiText.updateConversate?.(nativeConversateContent(), priority);
              return;
            }
            drawCurrentPage();
            requestVisibleRefresh("right");
          },
        });
        liveSession = createLiveDashboardSession({
          bridge: sensorAwareBridge,
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
    setCompanionDisplayVisible,
    setCompanionSensors,
    setConversateSnapshot,
    setRoutingStatus,
    setStatus,
  ]);
}

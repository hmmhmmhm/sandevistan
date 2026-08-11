import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserStorage } from "./browser-storage";
import { useHudController } from "./fast-hud-controller";
import { resolveG2DisplayHideStrategy } from "./g2-display-hide";
import { resolveG2TileImageFormat } from "./g2-tile-format";
import { resolveG2TilePaletteMode } from "./g2-tile-palette";
import { resolveHudModeResolution } from "./hud-mode-resolution";
import { resolveImageSendConcurrency } from "./image-send-concurrency";
import type { FastCanvasBattery } from "./glasses";
import { createLiveDashboardSession } from "./live-dashboard";
import type { EvenStorage } from "./live-cache";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
  type XHudPost,
} from "./live-state";
import { resolveOrsKey } from "./ors-key";
import { resolvePhoneLocale } from "./phone-i18n";
import {
  DEFAULT_PHONE_PREFERENCES,
  resolvePhonePreferences,
} from "./phone-preferences";
import type { PhonePreferences, SensorStatus } from "./phone-types";
import { PhoneCompanion } from "./phone/PhoneCompanion";
import {
  defaultRssSources,
  resolveRssSources,
  type RssSource,
} from "./rss-sources";
import { localizeBuiltInTodos } from "./todos";
import { RouteControls } from "./RouteControls";
import type {
  Destination,
  RouteProfile,
  RoutingStatus,
} from "./routing";
import {
  createAiHudSnapshot,
  type AiHudSnapshot,
} from "./ai-hud-state";
import {
  costSummaryForCurrentPeriod,
  resolveAiUsageLedger,
} from "./ai-cost";
import { resolveAiConversationHistory } from "./ai-history";
import { resolveOpenAiKey } from "./openai-key";
import { resolveSonioxKey } from "./soniox-key";
import { resolveXAccessToken, resolveXOAuthConfig, resolveXRelayUrl, type XOAuthConfig } from "./x-key";
import type { XTimeline } from "./x-feed";
import { TRANSPORT_STATUS } from "./transport-status";
import { useConversateCompanion } from "./use-conversate-companion";
import { HudSurface } from "./HudSurface";

type AppProps = { autoStart?: boolean };

export function App({ autoStart = true }: AppProps) {
  const displayHideStrategy = resolveG2DisplayHideStrategy(
    window.location.search,
  );
  const imageSendConcurrency = resolveImageSendConcurrency(
    window.location.search,
  );
  const tileImageFormat = resolveG2TileImageFormat(window.location.search);
  const tilePaletteMode = resolveG2TilePaletteMode(window.location.search);
  const {
    calibrationMode,
    canvasHudMode,
    diagnosticMode,
    fastCanvasHudMode,
    hardwareBmpMode,
    hybridHudMode,
    layeredHybridHudMode,
    modes,
  } = resolveHudModeResolution(
    window.location.pathname,
    window.location.search,
  );
  const xHudPostsRef = useRef<readonly XHudPost[]>([]);
  const syncXTimelineToHud = useCallback((timeline: XTimeline) => {
    const posts = timeline.posts.map((post) => ({
      id: post.id,
      text: post.text,
      author: post.author.name,
      username: post.author.username,
      createdAt: post.createdAt,
      imageUrl: post.media.find((media) => media.kind === "photo")?.url,
      avatarUrl: post.author.avatarUrl,
      repostedFrom: post.repostedFrom,
      quotedPost: post.quotedPost ? {
        author: post.quotedPost.author.name,
        username: post.quotedPost.author.username,
        text: post.quotedPost.text,
      } : undefined,
      metrics: post.metrics,
    }));
    xHudPostsRef.current = posts;
    liveSessionRef.current?.replaceX?.(posts);
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveSessionRef = useRef<
    ReturnType<typeof createLiveDashboardSession> | undefined
  >(undefined);
  const displayRefreshRef = useRef<(() => void) | undefined>(undefined);
  const [status, setStatus] = useState<string>(
    autoStart ? TRANSPORT_STATUS.preparing : TRANSPORT_STATUS.disabled,
  );
  const [routingStatus, setRoutingStatus] = useState<RoutingStatus>({
    enabled: false,
  });
  const [companionRoute, setCompanionRoute] = useState<
    LiveDashboardState["route"]
  >({ status: "disabled" });
  const [companionLive, setCompanionLive] = useState<LiveDashboardState>(() => {
    const initial = createInitialLiveDashboardState();
    const initialLocale = resolvePhoneLocale(
      DEFAULT_PHONE_PREFERENCES.locale,
      typeof navigator === "undefined" ? "en" : navigator.language,
    );
    return {
      ...initial,
      todos: {
        ...initial.todos,
        value: localizeBuiltInTodos(
          initial.todos.value ?? [],
          initialLocale,
        ),
      },
    };
  });
  const [companionBattery, setCompanionBattery] = useState<
    FastCanvasBattery | undefined
  >();
  const [companionDisplayVisible, setCompanionDisplayVisible] = useState(true);
  const [companionSensors, setCompanionSensors] = useState<SensorStatus>({
    microphone: "unknown",
    location: "unknown",
    imu: "unknown",
  });
  const [companionStorage, setCompanionStorage] = useState<EvenStorage>(
    createBrowserStorage,
  );
  const [phonePreferences, setPhonePreferencesState] = useState<
    PhonePreferences
  >(DEFAULT_PHONE_PREFERENCES);
  const phonePreferencesRef = useRef<PhonePreferences>(
    DEFAULT_PHONE_PREFERENCES,
  );
  const phonePreferencesRevisionRef = useRef(0);
  const [companionOrsKey, setCompanionOrsKeyState] = useState<string>();
  const companionOrsKeyRef = useRef<string | undefined>(undefined);
  const [companionOpenAiKey, setCompanionOpenAiKeyState] = useState<string>();
  const companionOpenAiKeyRef = useRef<string | undefined>(undefined);
  const [companionSonioxKey, setCompanionSonioxKeyState] = useState<string>();
  const [companionXAccessToken, setCompanionXAccessToken] = useState<string>();
  const [companionXRelayUrl, setCompanionXRelayUrl] = useState<string>();
  const [companionXOAuthConfig, setCompanionXOAuthConfig] = useState<XOAuthConfig>();
  const companionSonioxKeyRef = useRef<string | undefined>(undefined);
  const [companionAiSnapshot, setCompanionAiSnapshotState] = useState(
    () => createAiHudSnapshot(false),
  );
  const aiSnapshotRef = useRef<AiHudSnapshot>(createAiHudSnapshot(false));
  const [companionRssSources, setCompanionRssSources] = useState<
    readonly RssSource[]
  >(defaultRssSources("ko"));
  const conversate = useConversateCompanion(companionStorage, fastCanvasHudMode);
  const phoneNavigationAvailable = routingStatus.enabled
    || companionOrsKey !== undefined;

  const setPhonePreferences = useCallback((value: PhonePreferences) => {
    const browserLanguage = typeof navigator === "undefined"
      ? "en"
      : navigator.language;
    const previousLocale = resolvePhoneLocale(
      phonePreferencesRef.current.locale,
      browserLanguage,
    );
    const nextLocale = resolvePhoneLocale(value.locale, browserLanguage);
    phonePreferencesRef.current = value;
    phonePreferencesRevisionRef.current += 1;
    setPhonePreferencesState(value);
    if (nextLocale !== previousLocale) {
      setCompanionLive((current) => {
        if (!current.todos.value) return current;
        return {
          ...current,
          todos: {
            ...current.todos,
            value: localizeBuiltInTodos(current.todos.value, nextLocale),
          },
        };
      });
      liveSessionRef.current?.refreshLocale?.();
    }
    displayRefreshRef.current?.();
  }, []);
  const setCompanionOrsKey = (value: string | undefined) => {
    companionOrsKeyRef.current = value;
    setCompanionOrsKeyState(value);
    liveSessionRef.current?.setRoutingKey?.(value);
  };
  const setCompanionOpenAiKey = (value: string | undefined) => {
    companionOpenAiKeyRef.current = value;
    setCompanionOpenAiKeyState(value);
  };
  const setCompanionSonioxKey = (value: string | undefined) => {
    companionSonioxKeyRef.current = value;
    setCompanionSonioxKeyState(value);
  };
  const setCompanionAiSnapshot = useCallback((value: AiHudSnapshot) => {
    aiSnapshotRef.current = value;
    setCompanionAiSnapshotState(value);
  }, []);
  const phoneLocale = resolvePhoneLocale(
    phonePreferences.locale,
    typeof navigator === "undefined" ? "en" : navigator.language,
  );

  useEffect(() => {
    if (!fastCanvasHudMode) return;
    let active = true;
    const revision = phonePreferencesRevisionRef.current;
    void resolvePhonePreferences(
      companionStorage,
      phoneNavigationAvailable,
    ).then((value) => {
      if (
        active
        && phonePreferencesRevisionRef.current === revision
      ) {
        setPhonePreferences(value);
      }
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode, phoneNavigationAvailable]);

  useEffect(() => {
    if (!fastCanvasHudMode) return;
    let active = true;
    void resolveOrsKey(companionStorage).then((value) => {
      if (active) setCompanionOrsKey(value);
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode]);

  useEffect(() => {
    if (!fastCanvasHudMode) return;
    let active = true;
    void resolveRssSources(companionStorage, phoneLocale).then((value) => {
      if (!active) return;
      setCompanionRssSources(value);
      void liveSessionRef.current?.refreshNewsSources?.();
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode, phoneLocale]);

  useEffect(() => {
    if (!fastCanvasHudMode) return;
    let active = true;
    void Promise.all([
      resolveOpenAiKey(companionStorage),
      resolveSonioxKey(companionStorage),
      resolveXAccessToken(companionStorage),
      resolveXOAuthConfig(companionStorage),
      resolveXRelayUrl(companionStorage),
      resolveAiConversationHistory(companionStorage),
      resolveAiUsageLedger(companionStorage),
    ]).then(([key, sonioxKey, xAccessToken, xOAuthConfig, xRelayUrl, history, ledger]) => {
      if (!active) return;
      const costs = costSummaryForCurrentPeriod(ledger);
      setCompanionOpenAiKey(key);
      setCompanionSonioxKey(sonioxKey);
      setCompanionXAccessToken(xAccessToken);
      setCompanionXOAuthConfig(xOAuthConfig);
      setCompanionXRelayUrl(xRelayUrl);
      setCompanionAiSnapshot(createAiHudSnapshot(
        Boolean(key),
        history,
        costs.weekUsd,
        costs.monthUsd,
        costs.hasUnpricedUsage,
      ));
    });
    return () => {
      active = false;
    };
  }, [companionStorage, fastCanvasHudMode]);

  useHudController({
    autoStart,
    canvasRef,
    liveSessionRef,
    xHudPostsRef,
    phonePreferencesRef,
    displayRefreshRef,
    companionOrsKeyRef,
    companionOpenAiKeyRef,
    companionSonioxKeyRef,
    aiSnapshotRef,
    conversateSettingsRef: conversate.settingsRef,
    conversateSnapshotRef: conversate.snapshotRef,
    displayHideStrategy,
    imageSendConcurrency,
    tileImageFormat,
    tilePaletteMode,
    modes,
    setStatus,
    setRoutingStatus,
    setCompanionRoute,
    setCompanionLive,
    setCompanionBattery,
    setCompanionStorage,
    setPhonePreferences,
    setCompanionAiSnapshot,
    setConversateSnapshot: conversate.setSnapshot,
    setCompanionDisplayVisible,
    setCompanionSensors,
  });

  const startCompanionRoute = async (
    destination: Destination,
    profile: RouteProfile,
  ) => {
    const session = liveSessionRef.current;
    if (!session) throw new Error("길찾기 세션이 아직 준비되지 않았습니다.");
    await session.startRoute(destination, profile);
  };
  const endCompanionRoute = async () => {
    const session = liveSessionRef.current;
    if (!session) throw new Error("길찾기 세션이 아직 준비되지 않았습니다.");
    await session.endRoute();
  };
  const resumeCompanionRoute = async () => {
    const session = liveSessionRef.current;
    if (!session) throw new Error("길찾기 세션이 아직 준비되지 않았습니다.");
    await session.resumeRoute();
  };
  const activeCompanionRoute = companionRoute.status === "fresh"
    || companionRoute.status === "stale"
    || companionRoute.status === "loading"
    ? companionRoute.value
    : undefined;
  const effectiveRoutingStatus: RoutingStatus = {
    enabled: phoneNavigationAvailable,
  };

  const hudSurface = <HudSurface canvasRef={canvasRef} modes={modes} locale={phoneLocale} />;

  if (fastCanvasHudMode) {
    return (
      <PhoneCompanion
        canvas={hudSurface}
        status={status}
        previewLoading={status === TRANSPORT_STATUS.preparing}
        battery={companionBattery}
        displayVisible={companionDisplayVisible}
        sensors={companionSensors}
        live={companionLive}
        routingStatus={effectiveRoutingStatus}
        preferences={phonePreferences}
        storage={companionStorage}
        onPreferencesChange={setPhonePreferences}
        onTodosChange={(items) => {
          liveSessionRef.current?.replaceTodos?.(items);
          setCompanionLive((current) => ({
            ...current,
            todos: { status: "fresh", value: items },
          }));
        }}
        onWeatherRefresh={() => (
          liveSessionRef.current?.refreshWeather?.()
          ?? Promise.resolve("dropped")
        )}
        rssSources={companionRssSources}
        onRssSourcesChange={(sources) => {
          setCompanionRssSources(sources);
          void liveSessionRef.current?.refreshNewsSources?.();
        }}
        onOrsKeyChange={setCompanionOrsKey}
        openAiKey={companionOpenAiKey}
        sonioxKey={companionSonioxKey}
        xAccessToken={companionXAccessToken}
        xOAuthConfig={companionXOAuthConfig}
        xRelayUrl={companionXRelayUrl}
        aiSnapshot={companionAiSnapshot}
        onOpenAiKeyChange={(key) => {
          setCompanionOpenAiKey(key);
          const next = {
            ...aiSnapshotRef.current,
            configured: Boolean(key),
            phase: key ? "idle" as const : "unconfigured" as const,
            error: undefined,
          };
          setCompanionAiSnapshot(next);
          displayRefreshRef.current?.();
        }}
        onSonioxKeyChange={setCompanionSonioxKey}
        onXAccessTokenChange={setCompanionXAccessToken}
        onXOAuthConfigChange={setCompanionXOAuthConfig}
        onXRelayUrlChange={setCompanionXRelayUrl}
        onXTimelineChange={syncXTimelineToHud}
        onAiSnapshotChange={(snapshot) => {
          setCompanionAiSnapshot(snapshot);
          displayRefreshRef.current?.();
        }}
        conversateSettings={conversate.settings}
        conversateSnapshot={conversate.snapshot}
        onConversateSettingsChange={conversate.setSettings}
        onConversateSnapshotChange={conversate.setSnapshot}
        onDeleteRoute={endCompanionRoute}
        routeControls={(
          <RouteControls
            locale={phoneLocale}
            status={effectiveRoutingStatus}
            orsKey={companionOrsKey}
            activeRoute={activeCompanionRoute}
            routeStatus={companionRoute.status}
            onStart={startCompanionRoute}
            onResume={resumeCompanionRoute}
            onEnd={endCompanionRoute}
          />
        )}
      />
    );
  }

  return (
    <main className="preview-stage">
      <header className="preview-header">
        <div>
          <strong>SANDEVISTAN / G2 RASTER TEST</strong>
          <span>
            {hardwareBmpMode
              ? "1-BIT BMP · CLICK TO SEND"
              : diagnosticMode
                ? "OFFICIAL SAMPLE.PNG · RAW BYTES"
                : calibrationMode
                  ? "576×288 MAX BOUNDARY"
                  : layeredHybridHudMode
                    ? "STATIC CANVAS + NATIVE TEXT + Z-ORDER · SCROLL · 4 PAGES"
                    : hybridHudMode
                      ? "STATIC CANVAS + NATIVE TEXT · SCROLL · 4 PAGES"
                      : canvasHudMode
                        ? "576×288 · CANVAS HUD · SCROLL · 4 PAGES"
                        : "576×288 · 4 IMAGE TILES"}
            {" · STATIC MOCK"}
          </span>
        </div>
        <output aria-live="polite">{status}</output>
      </header>

      {hudSurface}

      <p className="preview-note">
        {hardwareBmpMode
          ? "안경에 준비 문구를 표시한 뒤 링/터치바를 클릭하면 200×100 1-bit BMP를 전송합니다."
          : diagnosticMode
            ? "진단 모드에서는 Even Realities 공식 sample.png 원본 바이트를 그대로 전송합니다."
            : calibrationMode
              ? "외곽 띠, 보조 테두리, 중앙 십자와 32px 눈금을 네 타일로 전송합니다."
              : layeredHybridHudMode
                ? "Canvas 배경 위에 명시적 최상위 레이어의 네이티브 Text를 표시합니다."
                : hybridHudMode
                  ? "Canvas에는 정적 배경만 보이며, 실제 안경 문구는 네이티브 Text로 한 번에 전환됩니다."
                  : canvasHudMode
                    ? "기본 뉴스 화면에서 아래 스크롤은 다음, 위 스크롤은 이전 페이지를 네 타일로 전송합니다."
                    : "이 Canvas가 네 장의 PNG로 나뉘어 안경에 순차 전송됩니다."}
      </p>
    </main>
  );
}

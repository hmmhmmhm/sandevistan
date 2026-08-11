import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FastCanvasBattery } from "../glasses";
import type { EvenStorage } from "../live-cache";
import type { LiveDashboardState, TodoItem } from "../live-state";
import { LOCALE_REGISTRY } from "../i18n/locale-registry";
import {
  resolvePhoneLocale,
  translatePhone,
  type PhoneStringKey,
} from "../phone-i18n";
import { PhoneIcon } from "../phone-icons";
import type {
  PhonePreferences,
  PhoneScreen,
  SensorStatus,
} from "../phone-types";
import type { RoutingStatus } from "../routing";
import { writePhonePreferences } from "../phone-preferences";
import type { RssSource } from "../rss-sources";
import { weatherCodeLabel } from "../weather";
import { transportStatusKey } from "../transport-status";
import { DevicesScreen } from "./DevicesScreen";
import { DeveloperScreen } from "./DeveloperScreen";
import { HudLayoutScreen } from "./HudLayoutScreen";
import { LanguageScreen } from "./LanguageScreen";
import { NavigationScreen } from "./NavigationScreen";
import { NewsScreen } from "./NewsScreen";
import { PhoneHeader } from "./PhoneHeader";
import { PhoneHome } from "./PhoneHome";
import { TodoScreen } from "./TodoScreen";
import { WeatherScreen } from "./WeatherScreen";
import { AiScreen } from "./AiScreen";
import { ConversateScreen } from "./ConversateScreen";
import { ByokScreen } from "./ByokScreen";
import { XScreen } from "./XScreen";
import {
  fetchXHomeTimeline,
  resolveXUserId,
  XApiError,
  type XTimeline,
} from "../x-feed";
import type { XOAuthConfig } from "../x-key";
import {
  clearXOAuthPending,
  resolveXOAuthPending,
  resolveXOAuthTokens,
  writeXOAuthTokens,
} from "../x-key";
import { exchangeXOAuthCode, refreshXOAuthTokens } from "../x-oauth";
import {
  createConversateSnapshot,
  DEFAULT_CONVERSATE_SETTINGS,
  type ConversateSettings,
  type ConversateSnapshot,
} from "../conversate-state";
import {
  createAiHudSnapshot,
  type AiHudSnapshot,
} from "../ai-hud-state";
import "./phone-shell.css";
import "./phone-home.css";
import "./phone-detail.css";

type PhoneCompanionProps = {
  readonly canvas: ReactNode;
  readonly status: string;
  readonly previewLoading?: boolean;
  readonly battery?: FastCanvasBattery;
  readonly displayVisible?: boolean;
  readonly sensors?: SensorStatus;
  readonly live: LiveDashboardState;
  readonly routingStatus: RoutingStatus;
  readonly preferences: PhonePreferences;
  readonly storage?: EvenStorage;
  readonly onPreferencesChange: (value: PhonePreferences) => void;
  readonly onTodosChange: (items: readonly TodoItem[]) => void;
  readonly onWeatherRefresh: () => Promise<"accepted" | "dropped">;
  readonly routeControls: ReactNode;
  readonly rssSources?: readonly RssSource[];
  readonly onRssSourcesChange?: (sources: readonly RssSource[]) => void;
  readonly onOrsKeyChange?: (key: string | undefined) => void;
  readonly onDeleteRoute?: () => void | Promise<void>;
  readonly openAiKey?: string;
  readonly sonioxKey?: string;
  readonly xAccessToken?: string;
  readonly xRelayUrl?: string;
  readonly xOAuthConfig?: XOAuthConfig;
  readonly aiSnapshot?: AiHudSnapshot;
  readonly onOpenAiKeyChange?: (key: string | undefined) => void;
  readonly onSonioxKeyChange?: (key: string | undefined) => void;
  readonly onXAccessTokenChange?: (key: string | undefined) => void;
  readonly onXRelayUrlChange?: (url: string | undefined) => void;
  readonly onXOAuthConfigChange?: (value: XOAuthConfig | undefined) => void;
  readonly onXTimelineChange?: (timeline: XTimeline) => void;
  readonly onAiSnapshotChange?: (snapshot: AiHudSnapshot) => void;
  readonly conversateSettings?: ConversateSettings;
  readonly conversateSnapshot?: ConversateSnapshot;
  readonly onConversateSettingsChange?: (settings: ConversateSettings) => void;
  readonly onConversateSnapshotChange?: (snapshot: ConversateSnapshot) => void;
};

const SCREEN_TITLE: Record<Exclude<PhoneScreen, "home">, PhoneStringKey> = {
  devices: "devices",
  "hud-layout": "hudLayout",
  news: "news",
  x: "news",
  todo: "todo",
  weather: "weather",
  ai: "ai",
  byok: "byokKeys",
  conversate: "conversate",
  navigation: "navigation",
  language: "language",
  developer: "developer",
};

function transportStatusLabel(
  status: string,
  t: (key: PhoneStringKey) => string,
): string {
  return t(transportStatusKey(status));
}

function xErrorMessage(error: unknown): string {
  if (!(error instanceof XApiError)) return "Could not reach X from this WebView.";
  if (error.reason === "network") return "X blocked this browser request (network or CORS).";
  if (error.status === 401) return "X rejected the token. Use OAuth 2.0 User Access Token, not Bearer Token or Refresh Token.";
  if (error.status === 403) return "X denied timeline access. Check tweet.read/users.read and your X API plan.";
  if (error.status === 402) return "X Home Timeline requires a paid X API plan for this project. The relay is connected; upgrade X access or use another feed.";
  if (error.status === 429) return "X rate limit reached. Try again later.";
  return `X request failed (${error.status ?? "unknown"}).`;
}

export function PhoneCompanion({
  canvas,
  status,
  previewLoading = false,
  battery,
  displayVisible = true,
  sensors = { microphone: "unknown", location: "unknown", imu: "unknown" },
  live,
  routingStatus,
  preferences,
  storage,
  onPreferencesChange,
  onTodosChange,
  onWeatherRefresh,
  routeControls,
  rssSources = [],
  onRssSourcesChange,
  onOrsKeyChange,
  onDeleteRoute,
  openAiKey,
  sonioxKey,
  xAccessToken,
  xRelayUrl,
  xOAuthConfig,
  aiSnapshot = createAiHudSnapshot(false),
  onOpenAiKeyChange,
  onSonioxKeyChange,
  onXAccessTokenChange,
  onXRelayUrlChange,
  onXOAuthConfigChange,
  onXTimelineChange,
  onAiSnapshotChange,
  conversateSettings = DEFAULT_CONVERSATE_SETTINGS,
  conversateSnapshot = createConversateSnapshot(),
  onConversateSettingsChange,
  onConversateSnapshotChange,
}: PhoneCompanionProps) {
  const [screen, setScreen] = useState<PhoneScreen>("home");
  const [xTimeline, setXTimeline] = useState<XTimeline>({ posts: [] });
  const [xLoading, setXLoading] = useState(false);
  const [xError, setXError] = useState<string>();
  const locale = resolvePhoneLocale(
    preferences.locale,
    typeof navigator === "undefined" ? "en" : navigator.language,
  );
  const t = (key: PhoneStringKey) => translatePhone(locale, key);
  const localizedStatus = transportStatusLabel(status, t);

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
  }, [screen]);

  useEffect(() => {
    if (!storage || !xOAuthConfig || !xRelayUrl) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;
    void resolveXOAuthPending(storage).then(async (pending) => {
      if (!pending || pending.state !== state) {
        setXError("X sign-in could not be verified. Start Connect X again.");
        return;
      }
      try {
        const tokens = await exchangeXOAuthCode(xOAuthConfig, code, pending.codeVerifier, xRelayUrl);
        await writeXOAuthTokens(storage, tokens);
        await clearXOAuthPending(storage);
        onXAccessTokenChange?.(tokens.accessToken);
        window.history.replaceState({}, "", window.location.pathname);
        setScreen("x");
      } catch (error) {
        setXError(error instanceof Error ? error.message : "X sign-in failed.");
      }
    });
  }, [storage, xOAuthConfig, xRelayUrl, onXAccessTokenChange]);

  useEffect(() => {
    if (!storage || !xOAuthConfig || !xRelayUrl) return;
    let timer: number | undefined;
    let cancelled = false;
    const schedule = async () => {
      const tokens = await resolveXOAuthTokens(storage);
      if (!tokens || cancelled) return;
      const renew = async () => {
        try {
          const refreshed = await refreshXOAuthTokens(xOAuthConfig, tokens.refreshToken, xRelayUrl);
          if (cancelled) return;
          await writeXOAuthTokens(storage, refreshed);
          onXAccessTokenChange?.(refreshed.accessToken);
          timer = window.setTimeout(() => void schedule(), Math.max(30_000, refreshed.expiresAt - Date.now() - 60_000));
        } catch {
          if (!cancelled) setXError("X session expired. Connect X again from BYOK Keys.");
        }
      };
      const delay = Math.max(0, tokens.expiresAt - Date.now() - 60_000);
      timer = window.setTimeout(() => void renew(), delay);
    };
    void schedule();
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [storage, xOAuthConfig, xRelayUrl, onXAccessTokenChange]);

  useEffect(() => {
    if (!xAccessToken) {
      setXTimeline({ posts: [] });
      setXError(undefined);
      onXTimelineChange?.({ posts: [] });
      return;
    }
    let active = true;
    setXLoading(true);
    setXError(undefined);
    void (async () => {
      try {
        const userId = await resolveXUserId(xAccessToken, fetch, xRelayUrl);
        const timeline = await fetchXHomeTimeline(xAccessToken, userId, undefined, fetch, xRelayUrl);
        if (active) {
          setXTimeline(timeline);
          onXTimelineChange?.(timeline);
        }
      } catch (error) {
        if (active) setXError(xErrorMessage(error));
      } finally {
        if (active) setXLoading(false);
      }
    })();
    return () => { active = false; };
  }, [xAccessToken, xRelayUrl, onXTimelineChange]);

  const loadMoreX = () => {
    if (!xAccessToken || !xTimeline.next || xLoading) return;
    setXLoading(true);
    setXError(undefined);
    void (async () => {
      try {
        const userId = await resolveXUserId(xAccessToken, fetch, xRelayUrl);
        const next = await fetchXHomeTimeline(xAccessToken, userId, xTimeline.next, fetch, xRelayUrl);
        setXTimeline((current) => {
          const timeline = { posts: [...current.posts, ...next.posts], next: next.next };
          onXTimelineChange?.(timeline);
          return timeline;
        });
      } catch (error) {
        setXError(xErrorMessage(error));
      } finally {
        setXLoading(false);
      }
    })();
  };

  const cards = useMemo(() => {
    const weather = live.weather.value;
    const enabledSources = rssSources.filter((source) => source.enabled).length;
    return [
      {
        screen: "devices",
        icon: "devices",
        titleKey: "devices",
        status: battery?.level === undefined
          ? t("unavailable")
          : `${battery.label} ${battery.level}%`,
      },
      {
        screen: "hud-layout",
        icon: "layout",
        titleKey: "hudLayout",
        status: `${preferences.enabled.length} ${t("active")}`,
      },
      {
        screen: "news",
        icon: "article",
        titleKey: "news",
        status: `${live.news.value?.length ?? 0} ${t("items")}`
          + ` · ${enabledSources} ${t("sources")}`,
      },
      {
        screen: "x",
        icon: "article",
        title: "X (Twitter)",
        titleKey: "news",
        status: xAccessToken
          ? `${xTimeline.posts.length} ${t("items")}`
          : t("notConfigured"),
      },
      {
        screen: "todo",
        icon: "checklist",
        titleKey: "todo",
        status: `${live.todos.value?.filter((item) => !item.completed).length ?? 0} ${t("items")}`,
      },
      {
        screen: "weather",
        icon: "weather",
        titleKey: "weather",
        status: weather
          ? `${Math.round(weather.temperature)}° · ${
              weatherCodeLabel(weather.weatherCode, locale)
            }`
          : t("noData"),
      },
      {
        screen: "navigation",
        icon: "navigation",
        titleKey: "navigation",
        status: routingStatus.enabled ? t("configured") : t("notConfigured"),
      },
      {
        screen: "language",
        icon: "language",
        titleKey: "language",
        status: preferences.locale === "system"
          ? t("system")
          : LOCALE_REGISTRY[preferences.locale].nativeName,
      },
      {
        screen: "byok",
        icon: "key",
        titleKey: "byokKeys",
        status: openAiKey || sonioxKey ? t("configured") : t("notConfigured"),
      },
      {
        screen: "ai",
        icon: "ai",
        titleKey: "ai",
        status: openAiKey ? t("ready") : t("aiKeyRequired"),
      },
      {
        screen: "conversate",
        icon: "ai",
        titleKey: "conversate",
        status: openAiKey
          ? t(conversateSnapshot.phase === "listening" ? "live" : "ready")
          : t("keyRequired"),
      },
      {
        screen: "developer",
        icon: "debug",
        titleKey: "developer",
        status: localizedStatus,
      },
    ] as const;
  }, [
    battery,
    live,
    preferences,
    routingStatus.enabled,
    rssSources,
    localizedStatus,
    locale,
    openAiKey,
    xAccessToken,
    xTimeline.posts.length,
    conversateSnapshot.phase,
  ]);

  const savePreferences = async (next: PhonePreferences): Promise<boolean> => {
    if (!storage) return false;
    const saved = await writePhonePreferences(storage, next);
    if (saved) onPreferencesChange(next);
    return saved;
  };

  const updateAiTextInterval = (aiTextIntervalMs: number) => {
    const next = { ...preferences, aiTextIntervalMs };
    onPreferencesChange(next);
    if (storage) void writePhonePreferences(storage, next);
  };

  const content = () => {
    switch (screen) {
      case "devices":
        return (
          <DevicesScreen
            battery={battery}
            status={localizedStatus}
            t={t}
          />
        );
      case "hud-layout":
        return (
          <HudLayoutScreen
            preferences={preferences}
            navigationAvailable={routingStatus.enabled}
            t={t}
            onChange={savePreferences}
          />
        );
      case "news":
        return (
          <NewsScreen
            storage={storage}
            locale={locale}
            t={t}
            onSourcesChange={onRssSourcesChange}
          />
        );
      case "x":
        return (
          <XScreen
            configured={Boolean(xAccessToken)}
            posts={xTimeline.posts}
            loading={xLoading}
            error={xError}
            canLoadMore={Boolean(xTimeline.next)}
            t={t}
            onLoadMore={loadMoreX}
          />
        );
      case "todo":
        return (
          <TodoScreen
            items={live.todos.value ?? []}
            storage={storage}
            t={t}
            onChange={onTodosChange}
          />
        );
      case "weather":
        return (
          <WeatherScreen
            live={live}
            locale={locale}
            t={t}
            onRefresh={onWeatherRefresh}
          />
        );
      case "navigation":
        return (
          <NavigationScreen
            storage={storage}
            routeControls={routeControls}
            t={t}
            serverConfigured={routingStatus.enabled}
            onDeleteRoute={onDeleteRoute}
            onKeyChange={onOrsKeyChange}
          />
        );
      case "language":
        return (
          <LanguageScreen
            value={preferences.locale}
            t={t}
            onChange={(value) => savePreferences({
              ...preferences,
              locale: value,
            })}
          />
        );
      case "ai":
        return (
          <AiScreen
            storage={storage}
            openAiKey={openAiKey}
            snapshot={aiSnapshot}
            t={t}
            onKeyChange={onOpenAiKeyChange}
            onSnapshotChange={onAiSnapshotChange}
            textIntervalMs={preferences.aiTextIntervalMs}
            onTextIntervalChange={updateAiTextInterval}
          />
        );
      case "byok":
        return (
          <ByokScreen
            storage={storage}
            openAiKey={openAiKey}
            sonioxKey={sonioxKey}
            xAccessToken={xAccessToken}
            xRelayUrl={xRelayUrl}
            xOAuthConfig={xOAuthConfig}
            t={t}
            onOpenAiKeyChange={onOpenAiKeyChange}
            onSonioxKeyChange={onSonioxKeyChange}
            onXRelayUrlChange={onXRelayUrlChange}
            onXOAuthConfigChange={onXOAuthConfigChange}
          />
        );
      case "conversate":
        return (
          <ConversateScreen
            storage={storage}
            locale={locale}
            settings={conversateSettings}
            snapshot={conversateSnapshot}
            openAiKey={openAiKey}
            sonioxKey={sonioxKey}
            t={t}
            onSettingsChange={onConversateSettingsChange}
            onSnapshotChange={onConversateSnapshotChange}
            onKeyChange={onOpenAiKeyChange}
            onSonioxKeyChange={onSonioxKeyChange}
          />
        );
      case "developer":
        return (
          <DeveloperScreen
          status={localizedStatus}
          routingEnabled={routingStatus.enabled}
          rssSources={rssSources}
          displayVisible={displayVisible}
          sensors={sensors}
          t={t}
          />
        );
      case "home":
        return null;
    }
  };

  return (
    <main
      className="phone-companion"
      data-testid="phone-companion"
      lang={locale}
      dir={LOCALE_REGISTRY[locale].direction}
    >
      <div hidden={screen !== "home"}>
        <PhoneHome
          t={t}
          cards={cards}
          preview={canvas}
          previewLoading={previewLoading}
          previewActive={displayVisible}
          xPosts={xTimeline.posts.slice(0, 7)}
          onOpen={setScreen}
        />
      </div>
      {screen !== "home" && (
        <section className="phone-detail-screen">
          <PhoneHeader
            title={t(SCREEN_TITLE[screen])}
            parentLabel={t("dashboard")}
            onBack={() => setScreen("home")}
          />
          <button
            type="button"
            className="phone-detail-back"
            onClick={() => setScreen("home")}
          >
            <PhoneIcon name="back" size={24} />
            <span>{t("backToDashboard")}</span>
          </button>
          <div className="phone-detail-content">{content()}</div>
        </section>
      )}
    </main>
  );
}

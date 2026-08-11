import {
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
  readonly aiSnapshot?: AiHudSnapshot;
  readonly onOpenAiKeyChange?: (key: string | undefined) => void;
  readonly onSonioxKeyChange?: (key: string | undefined) => void;
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
  aiSnapshot = createAiHudSnapshot(false),
  onOpenAiKeyChange,
  onSonioxKeyChange,
  onAiSnapshotChange,
  conversateSettings = DEFAULT_CONVERSATE_SETTINGS,
  conversateSnapshot = createConversateSnapshot(),
  onConversateSettingsChange,
  onConversateSnapshotChange,
}: PhoneCompanionProps) {
  const [screen, setScreen] = useState<PhoneScreen>("home");
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
            t={t}
            onOpenAiKeyChange={onOpenAiKeyChange}
            onSonioxKeyChange={onSonioxKeyChange}
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

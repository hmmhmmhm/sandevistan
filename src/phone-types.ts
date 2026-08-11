import type { DataStatus, LiveDashboardState } from "./live-state";
import type { FastCanvasBattery } from "./glasses";
import type {
  LocaleSetting,
  SupportedLocale,
} from "./i18n/locale-registry";
import type { RoutingStatus } from "./routing";

export type HudPageId =
  | "overview"
  | "news"
  | "todo"
  | "weather"
  | "ai"
  | "conversate"
  | "navigation";

export type PhoneLocale = SupportedLocale;
export type PhoneLocaleSetting = LocaleSetting;

export type PhoneScreen =
  | "home"
  | "devices"
  | "hud-layout"
  | "news"
  | "todo"
  | "weather"
  | "ai"
  | "byok"
  | "conversate"
  | "navigation"
  | "language"
  | "developer";

export type PhonePreferences = {
  readonly locale: PhoneLocaleSetting;
  readonly order: readonly HudPageId[];
  readonly enabled: readonly HudPageId[];
  readonly aiTextIntervalMs: number;
};

export type PhoneControllerSnapshot = {
  readonly status: string;
  readonly battery?: FastCanvasBattery;
  readonly live: LiveDashboardState;
  readonly routingStatus: RoutingStatus;
  readonly routeStatus: DataStatus;
};

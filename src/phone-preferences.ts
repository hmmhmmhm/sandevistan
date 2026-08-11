import { readCache, writeCache, type EvenStorage } from "./live-cache";
import { isSupportedLocale } from "./i18n/locale-registry";
import { normalizeAiPresentationInterval } from "./ai-presentation-pacer";
import type {
  HudPageId,
  PhoneLocaleSetting,
  PhonePreferences,
} from "./phone-types";

const KEYLESS_PAGES = [
  "overview",
  "news",
  "x",
  "todo",
  "weather",
  "ai",
  "conversate",
] as const satisfies readonly HudPageId[];

const ALL_PAGES = [
  ...KEYLESS_PAGES,
  "navigation",
] as const satisfies readonly HudPageId[];

const PAGE_IDS = new Set<HudPageId>(ALL_PAGES);

function isLocaleSetting(value: unknown): value is PhoneLocaleSetting {
  return value === "system" || isSupportedLocale(value);
}

export const DEFAULT_PHONE_PREFERENCES: PhonePreferences = {
  locale: "system",
  order: KEYLESS_PAGES,
  enabled: KEYLESS_PAGES,
  aiTextIntervalMs: 200,
  dashboardMapEnabled: true,
};

type StoredPhonePreferences = Omit<PhonePreferences, "aiTextIntervalMs" | "dashboardMapEnabled"> & {
  readonly aiTextIntervalMs?: number;
  readonly dashboardMapEnabled?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPageArray(value: unknown): value is readonly HudPageId[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === "string" && PAGE_IDS.has(item as HudPageId));
}

function isPhonePreferences(value: unknown): value is StoredPhonePreferences {
  return isRecord(value)
    && typeof value.locale === "string"
    && isLocaleSetting(value.locale)
    && isPageArray(value.order)
    && isPageArray(value.enabled)
    && (value.aiTextIntervalMs === undefined
      || typeof value.aiTextIntervalMs === "number")
    && (value.dashboardMapEnabled === undefined
      || typeof value.dashboardMapEnabled === "boolean");
}

function clonePreferences(value: PhonePreferences): PhonePreferences {
  return {
    locale: value.locale,
    order: [...value.order],
    enabled: [...value.enabled],
    aiTextIntervalMs: normalizeAiPresentationInterval(value.aiTextIntervalMs),
    dashboardMapEnabled: value.dashboardMapEnabled,
  };
}

function isValidLayout(
  value: PhonePreferences,
  navigationAvailable: boolean,
): boolean {
  const available: readonly HudPageId[] = navigationAvailable
    ? ALL_PAGES
    : KEYLESS_PAGES;
  if (
    value.order[0] !== "overview"
    || new Set(value.order).size !== value.order.length
    || value.order.some((page) => !available.includes(page))
    || KEYLESS_PAGES.some((page) => !value.order.includes(page))
    || (!navigationAvailable && value.order.length !== KEYLESS_PAGES.length)
    || value.enabled[0] !== "overview"
    || new Set(value.enabled).size !== value.enabled.length
    || value.enabled.some((page) => !value.order.includes(page))
  ) {
    return false;
  }
  return true;
}

export function normalizePhonePreferences(
  value: StoredPhonePreferences,
  navigationAvailable: boolean,
): PhonePreferences {
  const withInterval: PhonePreferences = {
    ...value,
    aiTextIntervalMs: normalizeAiPresentationInterval(
      value.aiTextIntervalMs,
    ),
    dashboardMapEnabled: value.dashboardMapEnabled !== false,
  };
  const withAi: PhonePreferences = !withInterval.order.includes("ai")
    ? {
        ...withInterval,
        order: withInterval.order.includes("navigation")
          ? [
              ...withInterval.order.filter((page) => page !== "navigation"),
              "ai" as const,
              "navigation" as const,
            ]
          : [...withInterval.order, "ai" as const],
        enabled: [...withInterval.enabled, "ai" as const],
      }
    : withInterval;
  const withConversate: PhonePreferences = !withAi.order.includes("conversate")
    ? {
        ...withAi,
        order: withAi.order.includes("navigation")
          ? [
              ...withAi.order.filter((page) => page !== "navigation"),
              "conversate" as const,
              "navigation" as const,
            ]
          : [...withAi.order, "conversate" as const],
        enabled: [...withAi.enabled, "conversate" as const],
      }
    : withAi;
  const migrated: PhonePreferences = !withConversate.order.includes("x")
    ? {
        ...withConversate,
        order: withConversate.order.includes("navigation")
          ? [...withConversate.order.filter((page) => page !== "navigation"), "x" as const, "navigation" as const]
          : [...withConversate.order, "x" as const],
        enabled: [...withConversate.enabled, "x" as const],
      }
    : withConversate;
  if (!isValidLayout(migrated, navigationAvailable)) {
    return {
      ...DEFAULT_PHONE_PREFERENCES,
      locale: isLocaleSetting(value.locale) ? value.locale : "system",
      order: navigationAvailable
        ? [...DEFAULT_PHONE_PREFERENCES.order, "navigation"]
        : [...DEFAULT_PHONE_PREFERENCES.order],
      enabled: [...DEFAULT_PHONE_PREFERENCES.enabled],
      aiTextIntervalMs: withInterval.aiTextIntervalMs,
    };
  }
  return {
    ...clonePreferences(migrated),
    order: navigationAvailable && !migrated.order.includes("navigation")
      ? [...migrated.order, "navigation"]
      : [...migrated.order],
  };
}

export async function resolvePhonePreferences(
  storage: EvenStorage,
  navigationAvailable: boolean,
): Promise<PhonePreferences> {
  const cached = await readCache(
    storage,
    "phone-preferences",
    isPhonePreferences,
  );
  return normalizePhonePreferences(
    cached ?? DEFAULT_PHONE_PREFERENCES,
    navigationAvailable,
  );
}

export function writePhonePreferences(
  storage: EvenStorage,
  value: PhonePreferences,
): Promise<boolean> {
  return writeCache(storage, "phone-preferences", clonePreferences(value));
}

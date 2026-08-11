import { useState } from "react";
import type { PhoneStringKey } from "../phone-i18n";
import type { HudPageId, PhonePreferences } from "../phone-types";
import { PhoneIcon } from "../phone-icons";

const PAGE_KEYS: Record<HudPageId, PhoneStringKey> = {
  overview: "overview",
  news: "news",
  x: "news",
  todo: "todo",
  weather: "weather",
  ai: "ai",
  conversate: "conversate",
  navigation: "navigation",
};

export function HudLayoutScreen({
  preferences,
  navigationAvailable,
  t,
  onChange,
}: {
  readonly preferences: PhonePreferences;
  readonly navigationAvailable: boolean;
  readonly t: (key: PhoneStringKey) => string;
  readonly onChange: (value: PhonePreferences) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const pages = preferences.order.filter(
    (page) => page !== "navigation" || navigationAvailable,
  );

  const commit = async (next: PhonePreferences) => {
    if (saving) return;
    setSaving(true);
    const saved = await onChange(next);
    setError(saved ? undefined : t("storageFailed"));
    setSaving(false);
  };

  const toggle = (page: HudPageId) => {
    if (page === "overview") return;
    const enabled = preferences.enabled.includes(page)
      ? preferences.enabled.filter((candidate) => candidate !== page)
      : [...preferences.enabled, page];
    void commit({ ...preferences, enabled });
  };

  const move = (page: HudPageId, offset: -1 | 1) => {
    const current = preferences.order.indexOf(page);
    const target = current + offset;
    if (page === "overview" || target < 1 || target >= pages.length) return;
    const order = [...preferences.order];
    [order[current], order[target]] = [order[target], order[current]];
    void commit({ ...preferences, order });
  };

  return (
    <div className="phone-detail-stack">
      <section className="phone-panel phone-reorder-list">
        <button
          type="button"
          className="phone-toggle-row"
          disabled={saving}
          aria-pressed={preferences.dashboardMapEnabled}
          onClick={() => void commit({
            ...preferences,
            dashboardMapEnabled: !preferences.dashboardMapEnabled,
          })}
        >
          <PhoneIcon
            name={preferences.dashboardMapEnabled ? "checkboxOn" : "checkbox"}
            size={22}
          />
          <span className="phone-toggle-row__copy">
            <span>{t("dashboardMap")}</span>
            <small>{preferences.dashboardMapEnabled ? t("enabled") : t("disabled")}</small>
          </span>
        </button>
      </section>
      <section className="phone-panel phone-reorder-list">
        {pages.map((page, index) => {
          const locked = page === "overview";
          const enabled = preferences.enabled.includes(page);
          return (
            <div key={page} className="phone-reorder-row">
              <button
                type="button"
                className="phone-toggle-row"
                disabled={locked || saving}
                aria-pressed={enabled}
                onClick={() => toggle(page)}
              >
                <PhoneIcon
                  name={enabled ? "checkboxOn" : "checkbox"}
                  size={22}
                />
                <span className="phone-toggle-row__copy">
                  <span>{t(PAGE_KEYS[page])}</span>
                  <small>
                    {locked
                      ? t("locked")
                      : enabled
                        ? t("enabled")
                        : t("disabled")}
                  </small>
                </span>
              </button>
              <div className="phone-reorder-actions">
                <button
                  type="button"
                  aria-label={`${t("moveUp")} ${t(PAGE_KEYS[page])}`}
                  disabled={locked || saving || index <= 1}
                  onClick={() => move(page, -1)}
                >
                  <PhoneIcon name="arrowUp" size={21} />
                </button>
                <button
                  type="button"
                  aria-label={`${t("moveDown")} ${t(PAGE_KEYS[page])}`}
                  disabled={locked || saving || index === pages.length - 1}
                  onClick={() => move(page, 1)}
                >
                  <PhoneIcon name="arrowDown" size={21} />
                </button>
              </div>
            </div>
          );
        })}
      </section>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
    </div>
  );
}

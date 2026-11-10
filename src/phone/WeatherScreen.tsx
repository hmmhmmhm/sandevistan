import { getReleaseCopy } from "../release-i18n";
import { useState } from "react";
import type { PhoneStringKey } from "../phone-i18n";
import type { LiveDashboardState } from "../live-state";
import { PhoneIcon } from "../phone-icons";
import type { PhoneLocale } from "../phone-types";
import { weatherCodeLabel } from "../weather";
import { mapLabelName } from "../map";

function valueOrDash(value: number | undefined, suffix: string): string {
  return value === undefined ? "—" : `${Math.round(value)}${suffix}`;
}

function locationText(
  live: LiveDashboardState,
  locale: PhoneLocale,
): string {
  const coordinate = live.location.value?.coordinate;
  if (!coordinate) return "—";
  const labels = live.map.value?.labels ?? [];
  const nearest = labels.reduce<(typeof labels)[number] | undefined>(
    (current, candidate) => {
      if (!current) return candidate;
      const distance = (point: typeof candidate.point) => (
        (point.latitude - coordinate.latitude) ** 2
        + (point.longitude - coordinate.longitude) ** 2
      );
      return distance(candidate.point) < distance(current.point)
        ? candidate
        : current;
    },
    undefined,
  );
  return nearest
    ? mapLabelName(nearest, locale)
    : `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`;
}

export function WeatherScreen({
  live,
  locale,
  t,
  onRefresh,
}: {
  readonly live: LiveDashboardState;
  readonly locale: PhoneLocale;
  readonly t: (key: PhoneStringKey) => string;
  readonly onRefresh: () => Promise<"accepted" | "dropped">;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageIsError, setMessageIsError] = useState(false);
  const weather = live.weather.value;
  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    setMessageIsError(false);
    try {
      const result = await onRefresh();
      setMessage(result === "dropped" ? t("refreshBusy") : undefined);
    } catch {
      setMessage(t("refreshFailed"));
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="phone-detail-stack">
      <section className="phone-panel phone-weather-hero">
        <PhoneIcon name="weather" size={58} />
        <div>
          <strong>{weather ? `${Math.round(weather.temperature)}°` : "—"}</strong>
          <span>
            {weather
              ? weatherCodeLabel(weather.weatherCode, locale)
              : t("noData")}
          </span>
        </div>
      </section>
      <section className="phone-panel">
        <dl className="phone-data-list">
          <div><dt>{t("location")}</dt><dd>{locationText(live, locale)}</dd></div>
          <div><dt>{t("apparent")}</dt><dd>{valueOrDash(weather?.apparentTemperature, "°")}</dd></div>
          <div><dt>{t("humidity")}</dt><dd>{valueOrDash(weather?.humidity, "%")}</dd></div>
          <div><dt>{t("precipitation")}</dt><dd>{valueOrDash(weather?.precipitationProbability, "%")}</dd></div>
          <div><dt>{t("wind")}</dt><dd>{valueOrDash(weather?.windSpeed, " km/h")}</dd></div>
          <div>
            <dt>{t("lastRefresh")}</dt>
            <dd>{live.weather.fetchedAt
              ? new Date(live.weather.fetchedAt).toLocaleTimeString()
              : "—"}</dd>
          </div>
        </dl>
      </section>
      <button
        type="button"
        className="phone-primary-button"
        disabled={busy}
        onClick={() => void refresh()}
      >
        <PhoneIcon name="reload" size={22} />
        {busy ? t("refreshing") : t("refresh")}
      </button>
      <p className="phone-form-message"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{getReleaseCopy(locale, "sourceWeather")}</a></p>
      {message && (
        <p
          role={messageIsError ? "alert" : "status"}
          className="phone-form-message"
        >
          {message}
        </p>
      )}
    </div>
  );
}

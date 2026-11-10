import { getReleaseCopy } from "../release-i18n";
import type { PhoneLocale } from "../phone-types";
import { DeviceHomeCard } from "./DeviceBattery";
import type { FastCanvasBattery } from "../glasses";
import type { ReactNode } from "react";
import { APP_VERSION } from "../app-metadata";
import type { PhoneStringKey } from "../phone-i18n";
import type { PhoneIconName } from "../phone-icons";
import { PhoneIcon } from "../phone-icons";
import type { PhoneScreen } from "../phone-types";

type HomeCard = {
  readonly screen: Exclude<PhoneScreen, "home">;
  readonly icon: PhoneIconName;
  readonly titleKey: PhoneStringKey;
  readonly status: string;
};

export function PhoneHome({
  t,
  locale = "en",
  cards,
  preview,
  appearance,
  battery,
  onOpen,
}: {
  readonly locale?: PhoneLocale;
  readonly t: (key: PhoneStringKey) => string;
  readonly cards: readonly HomeCard[];
  readonly preview: ReactNode;
  readonly appearance?: ReactNode;
  readonly battery?: FastCanvasBattery;
  readonly onOpen: (screen: Exclude<PhoneScreen, "home">) => void;
}) {
  return (
    <div className="phone-home">
      {appearance}
      <section className="phone-home__preview" aria-label={t("liveHudPreview")}>
        <div className="phone-home__preview-slot" data-phone-preview-slot>
          {preview}
        </div>
      </section>
      <h2 className="phone-home__section-title">{t("dashboard")}</h2>
      <nav className="phone-home__grid" aria-label={t("dashboard")}>
        {cards.map((card) => (
          <button
            key={card.screen}
            type="button"
            className={`phone-home-card${card.screen === "devices" ? " phone-home-card--devices" : ""}`}
            aria-label={card.screen === "devices" ? undefined : `${t(card.titleKey)} · ${card.status}`}
            onClick={() => onOpen(card.screen)}
          >
            {card.screen === "devices" ? <DeviceHomeCard battery={battery} t={t}/> : <>
            <PhoneIcon
              name={card.icon}
              size={30}
              className="phone-home-card__icon"
            />
            <span className="phone-home-card__copy">
              <strong>{t(card.titleKey)}</strong>
              <small>{card.status}</small>
            </span>
            </>}
          </button>
        ))}
      </nav>
      <footer className="phone-home__footer">
        <div>
          <strong>{t("project")}</strong>
          <span>v{APP_VERSION}</span>
        </div>
        <a
          href="https://github.com/hmmhmmhm/sandevistan"
          target="_blank"
          rel="noreferrer"
          aria-label={t("github")}
        >
          <PhoneIcon name="github" size={24} />
        </a>
        <p>
          © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>
          {" · "}© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
        </p>
        <p><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{getReleaseCopy(locale, "sourceWeather")}</a>{" · "}<a href="https://www.geonames.org/" target="_blank" rel="noreferrer">{getReleaseCopy(locale, "sourceGeocoding")}</a></p>
      </footer>
    </div>
  );
}

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
  readonly title?: string;
  readonly status: string;
};

export function PhoneHome({
  t,
  cards,
  preview,
  previewLoading = false,
  previewActive = false,
  onOpen,
}: {
  readonly t: (key: PhoneStringKey) => string;
  readonly cards: readonly HomeCard[];
  readonly preview: ReactNode;
  readonly previewLoading?: boolean;
  readonly previewActive?: boolean;
  readonly onOpen: (screen: Exclude<PhoneScreen, "home">) => void;
}) {
  return (
    <div className="phone-home">
      <section
        className="phone-home__preview"
        data-active={previewActive || undefined}
        aria-label={t("liveHudPreview")}
      >
        <div className="phone-home__preview-slot" data-phone-preview-slot>
          {preview}
          {previewLoading ? (
            <span className="phone-home__preview-loading" aria-live="polite">
              LOADING...
            </span>
          ) : null}
        </div>
      </section>
      <h2 className="phone-home__section-title">{t("dashboard")}</h2>
      <nav className="phone-home__grid" aria-label={t("dashboard")}>
        {cards.map((card) => (
          <button
            key={card.screen}
            type="button"
            className="phone-home-card"
            aria-label={`${card.title ?? t(card.titleKey)} · ${card.status}`}
            onClick={() => onOpen(card.screen)}
          >
            <PhoneIcon
              name={card.icon}
              size={30}
              className="phone-home-card__icon"
            />
            <span className="phone-home-card__copy">
              <strong>{card.title ?? t(card.titleKey)}</strong>
              <small>{card.status}</small>
            </span>
          </button>
        ))}
      </nav>
      <footer className="phone-home__footer">
        <div>
          <strong>Even Realities</strong>
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
      </footer>
    </div>
  );
}

import { getReleaseCopy } from "../release-i18n";
import type { PhoneLocale } from "../phone-types";
import { useState } from "react";
import { LOCALE_OPTIONS } from "../i18n/locale-registry";
import type { PhoneLocaleSetting } from "../phone-types";
import type { PhoneStringKey } from "../phone-i18n";

export function LanguageScreen({
  value,
  locale = "en",
  t,
  onChange,
}: {
  readonly locale?: PhoneLocale;
  readonly value: PhoneLocaleSetting;
  readonly t: (key: PhoneStringKey) => string;
  readonly onChange: (
    value: PhoneLocaleSetting,
  ) => boolean | Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const choices = [
    { value: "system" as const, label: t("system") },
    ...LOCALE_OPTIONS,
  ];
  const choose = async (choice: PhoneLocaleSetting) => {
    if (saving || choice === value) return;
    setSaving(true);
    const saved = await onChange(choice);
    setError(saved ? undefined : t("storageFailed"));
    setSaving(false);
  };
  return (
    <div className="phone-detail-stack">
      <p className="phone-form-message">{getReleaseCopy(locale, "translationQualityNotice")}</p>
      <fieldset className="phone-panel phone-choice-list">
        <legend className="phone-visually-hidden">{t("language")}</legend>
        {choices.map(({ value: choice, label }) => (
          <label key={choice}>
            <span>{label}</span>
            <input
              type="radio"
              name="phone-language"
              value={choice}
              checked={value === choice}
              disabled={saving}
              onChange={() => void choose(choice)}
            />
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
    </div>
  );
}

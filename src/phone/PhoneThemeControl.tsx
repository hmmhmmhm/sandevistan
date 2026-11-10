import { phoneThemeCopy } from "./phone-theme-i18n";
import type { PhoneLocale } from "../phone-types";
import type { PhoneTheme } from "./use-phone-theme";
export function PhoneThemeControl({ locale, value, onChange }: {
  readonly locale: PhoneLocale; readonly value: PhoneTheme; readonly onChange: (theme: PhoneTheme) => void;
}) {
  const copy = phoneThemeCopy(locale);
  return <fieldset className="phone-theme-control"><legend>{copy.label}</legend><div>
    {(["system", "light", "dark"] as const).map(choice => <label key={choice}>
      <input type="radio" name="phone-theme" value={choice} checked={value === choice} onChange={() => onChange(choice)} />
      <span>{copy[choice]}</span>
    </label>)}
  </div></fieldset>;
}

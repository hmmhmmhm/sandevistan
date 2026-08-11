import { useState, type FormEvent } from "react";
import type { EvenStorage } from "../live-cache";
import {
  clearOpenAiKey,
  maskOpenAiKey,
  validateOpenAiKey,
  writeOpenAiKey,
} from "../openai-key";
import type { PhoneStringKey } from "../phone-i18n";
import {
  clearSonioxKey,
  maskSonioxKey,
  validateSonioxKey,
  writeSonioxKey,
} from "../soniox-key";
import { clearXAccessToken, maskXAccessToken, validateXAccessToken, writeXAccessToken } from "../x-key";

type Validation = { readonly ok: true; readonly value: string } | { readonly ok: false };

function KeyPanel({
  storage,
  title,
  value,
  issueUrl,
  issueLabel,
  validate,
  write,
  clear,
  mask,
  onChange,
}: {
  readonly storage?: EvenStorage;
  readonly title: string;
  readonly value?: string;
  readonly issueUrl: string;
  readonly issueLabel: string;
  readonly validate: (value: string) => Validation;
  readonly write: (storage: EvenStorage, value: string) => Promise<boolean>;
  readonly clear: (storage: EvenStorage) => Promise<boolean>;
  readonly mask: (value: string) => string;
  readonly onChange?: (value: string | undefined) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const [error, setError] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!storage) return;
    const result = validate(candidate);
    if (!result.ok || !await write(storage, result.value)) {
      setError(true);
      return;
    }
    setCandidate("");
    setError(false);
    onChange?.(result.value);
  };
  return (
    <section className="phone-panel phone-stacked-form">
      <div className="phone-key-status">
        <div>
          <strong>{title}</strong>
          <span>{value ? mask(value) : "Not configured"}</span>
        </div>
        {value && (
          <button
            type="button"
            className="phone-danger-button"
            onClick={async () => {
              if (storage && await clear(storage)) onChange?.(undefined);
            }}
          >
            Delete
          </button>
        )}
      </div>
      <a className="phone-key-link" href={issueUrl} target="_blank" rel="noreferrer">
        {issueLabel} ↗
      </a>
      <form className="phone-stacked-form" onSubmit={save}>
        <label>
          <span>{title}</span>
          <input
            type="password"
            autoComplete="off"
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="phone-primary-button"
          disabled={!validate(candidate).ok}
        >
          Save
        </button>
      </form>
      {error && <p role="alert" className="phone-form-message">Validation failed.</p>}
    </section>
  );
}

export function ByokScreen({
  storage,
  openAiKey,
  sonioxKey,
  xAccessToken,
  t,
  onOpenAiKeyChange,
  onSonioxKeyChange,
  onXAccessTokenChange,
}: {
  readonly storage?: EvenStorage;
  readonly openAiKey?: string;
  readonly sonioxKey?: string;
  readonly xAccessToken?: string;
  readonly t: (key: PhoneStringKey) => string;
  readonly onOpenAiKeyChange?: (value: string | undefined) => void;
  readonly onSonioxKeyChange?: (value: string | undefined) => void;
  readonly onXAccessTokenChange?: (value: string | undefined) => void;
}) {
  return (
    <div className="phone-detail-stack">
      <section className="phone-panel phone-key-intro">
        <h2>{t("byokKeys")}</h2>
        <p>{t("keyLocalOnly")}</p>
        <p>These keys are shared by Ask AI and Conversate.</p>
        <p>{t("keylessDataInfo")}</p>
      </section>
      <KeyPanel
        storage={storage} title="X OAuth access token" value={xAccessToken}
        issueUrl="https://developer.x.com/en/portal/dashboard" issueLabel="Open X Developer Portal"
        validate={validateXAccessToken} write={writeXAccessToken} clear={clearXAccessToken}
        mask={maskXAccessToken} onChange={onXAccessTokenChange}
      />
      <p className="phone-form-message">For Home timeline, paste the OAuth 2.0 User Access Token only — not X's app Bearer Token, Client Secret, or Refresh Token.</p>
      <KeyPanel
        storage={storage}
        title="OpenAI API key"
        value={openAiKey}
        issueUrl="https://platform.openai.com/api-keys"
        issueLabel="Get an OpenAI API key"
        validate={validateOpenAiKey}
        write={writeOpenAiKey}
        clear={clearOpenAiKey}
        mask={maskOpenAiKey}
        onChange={onOpenAiKeyChange}
      />
      <KeyPanel
        storage={storage}
        title="Soniox ASR key"
        value={sonioxKey}
        issueUrl="https://console.soniox.com/"
        issueLabel="Get a Soniox ASR key"
        validate={validateSonioxKey}
        write={writeSonioxKey}
        clear={clearSonioxKey}
        mask={maskSonioxKey}
        onChange={onSonioxKeyChange}
      />
    </div>
  );
}

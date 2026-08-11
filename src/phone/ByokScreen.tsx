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
import {
  clearXRelayUrl,
  DEFAULT_X_RELAY_URL,
  validateXRelayUrl,
  writeXRelayUrl,
  type XOAuthConfig,
  validateXOAuthConfig,
  writeXOAuthConfig,
  clearXOAuthConfig,
  writeXOAuthPending,
} from "../x-key";
import { beginXOAuth } from "../x-oauth";

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
  inputType = "password",
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
  readonly inputType?: "password" | "url";
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
            type={inputType}
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
  xRelayUrl,
  xOAuthConfig,
  t,
  onOpenAiKeyChange,
  onSonioxKeyChange,
  onXRelayUrlChange,
  onXOAuthConfigChange,
}: {
  readonly storage?: EvenStorage;
  readonly openAiKey?: string;
  readonly sonioxKey?: string;
  readonly xAccessToken?: string;
  readonly xRelayUrl?: string;
  readonly xOAuthConfig?: XOAuthConfig;
  readonly t: (key: PhoneStringKey) => string;
  readonly onOpenAiKeyChange?: (value: string | undefined) => void;
  readonly onSonioxKeyChange?: (value: string | undefined) => void;
  readonly onXRelayUrlChange?: (value: string | undefined) => void;
  readonly onXOAuthConfigChange?: (value: XOAuthConfig | undefined) => void;
}) {
  const [customRelayOpen, setCustomRelayOpen] = useState(false);
  const activeRelayUrl = xRelayUrl ?? DEFAULT_X_RELAY_URL;
  const [clientId, setClientId] = useState(xOAuthConfig?.clientId ?? "");
  const [redirectUri, setRedirectUri] = useState(xOAuthConfig?.redirectUri ?? window.location.href.split("?")[0]);
  const [oauthError, setOauthError] = useState<string>();
  const saveOAuthConfig = async () => {
    if (!storage) return;
    const validated = validateXOAuthConfig(clientId, redirectUri);
    if (!validated.ok || !await writeXOAuthConfig(storage, validated.value)) {
      setOauthError("Enter the X Client ID and an HTTPS Redirect URI.");
      return;
    }
    setOauthError(undefined);
    onXOAuthConfigChange?.(validated.value);
  };
  const connectX = async () => {
    if (!storage) return;
    const validated = validateXOAuthConfig(clientId, redirectUri);
    if (!validated.ok) { setOauthError("Save a valid X Client ID and Redirect URI first."); return; }
    const pending = await beginXOAuth(validated.value);
    if (!await writeXOAuthPending(storage, pending)) { setOauthError("Could not save the secure PKCE session."); return; }
    window.location.assign(pending.url);
  };
  return (
    <div className="phone-detail-stack">
      <section className="phone-panel phone-key-intro">
        <h2>{t("byokKeys")}</h2>
        <p>{t("keyLocalOnly")}</p>
        <p>These keys are shared by Ask AI and Conversate.</p>
        <p>{t("keylessDataInfo")}</p>
      </section>
      <section className="phone-panel phone-stacked-form">
        <div className="phone-key-status"><div><strong>X OAuth 2.0 (PKCE)</strong><span>{xAccessToken ? "Connected · auto-renews locally" : "Not connected"}</span></div>{xOAuthConfig && <button type="button" className="phone-danger-button" onClick={async () => { if (storage && await clearXOAuthConfig(storage)) onXOAuthConfigChange?.(undefined); }}>Delete</button>}</div>
        <a className="phone-key-link" href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noreferrer">Configure X OAuth callback ↗</a>
        <label><span>X Client ID</span><input autoComplete="off" value={clientId} onChange={(event) => setClientId(event.target.value)} /></label>
        <label><span>Redirect URI</span><input type="url" autoComplete="off" value={redirectUri} onChange={(event) => setRedirectUri(event.target.value)} /></label>
        <button type="button" className="phone-primary-button" onClick={saveOAuthConfig}>Save OAuth settings</button>
        <button type="button" className="phone-primary-button" onClick={connectX} disabled={!storage}>Connect X securely</button>
        <p className="phone-form-message">Register this exact Redirect URI in X. Enable OAuth 2.0, PKCE, and tweet.read, users.read, offline.access. Do not enter a Client Secret.</p>
        {oauthError && <p role="alert" className="phone-form-message">{oauthError}</p>}
      </section>
      <section className="phone-panel phone-stacked-form">
        <div className="phone-key-status">
          <div>
            <strong>X Relay</strong>
            <span>{activeRelayUrl === DEFAULT_X_RELAY_URL ? "Default X-only relay" : "Custom X-only relay"}</span>
          </div>
        </div>
        <a className="phone-key-link" href={DEFAULT_X_RELAY_URL} target="_blank" rel="noreferrer">
          Open default relay ↗
        </a>
        <button type="button" className="phone-primary-button" onClick={() => setCustomRelayOpen((value) => !value)}>
          {customRelayOpen ? "Close custom relay" : "Customize relay"}
        </button>
      </section>
      {customRelayOpen && (
        <KeyPanel
          storage={storage}
          title="Custom X Relay URL"
          value={activeRelayUrl === DEFAULT_X_RELAY_URL ? undefined : activeRelayUrl}
          issueUrl="https://github.com/hmmhmmhm/sandevistan/tree/render-stability/x-relay"
          issueLabel="Deploy your own X Relay"
          validate={validateXRelayUrl}
          write={writeXRelayUrl}
          clear={clearXRelayUrl}
          mask={(value) => value}
          inputType="url"
          onChange={(value) => onXRelayUrlChange?.(value ?? DEFAULT_X_RELAY_URL)}
        />
      )}
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

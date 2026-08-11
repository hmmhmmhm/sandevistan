import { useState, type FormEvent } from "react";
import type { EvenStorage } from "../live-cache";
import type { PhoneStringKey } from "../phone-i18n";
import type { PhoneLocale } from "../phone-types";
import {
  clearConversateHistory,
  normalizeConversateSettings,
  writeConversateSettings,
  type ConversateSettings,
  type ConversateSnapshot,
} from "../conversate-state";
import { translateConversate } from "../conversate-i18n";
import {
  clearOpenAiKey,
  maskOpenAiKey,
  validateOpenAiKey,
  writeOpenAiKey,
} from "../openai-key";
import {
  clearSonioxKey,
  maskSonioxKey,
  validateSonioxKey,
  writeSonioxKey,
} from "../soniox-key";

export function ConversateScreen({
  storage,
  locale,
  settings,
  snapshot,
  openAiKey,
  sonioxKey,
  t,
  onSettingsChange,
  onSnapshotChange,
  onKeyChange,
  onSonioxKeyChange,
}: {
  readonly storage?: EvenStorage;
  readonly locale: PhoneLocale;
  readonly settings: ConversateSettings;
  readonly snapshot: ConversateSnapshot;
  readonly openAiKey?: string;
  readonly sonioxKey?: string;
  readonly t: (key: PhoneStringKey) => string;
  readonly onSettingsChange?: (value: ConversateSettings) => void;
  readonly onSnapshotChange?: (value: ConversateSnapshot) => void;
  readonly onKeyChange?: (value: string | undefined) => void;
  readonly onSonioxKeyChange?: (value: string | undefined) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const [sonioxCandidate, setSonioxCandidate] = useState("");
  const [keyError, setKeyError] = useState<string>();
  const tc = (key: Parameters<typeof translateConversate>[1]) => (
    translateConversate(locale, key)
  );
  const save = (patch: Partial<ConversateSettings>) => {
    const next = normalizeConversateSettings({ ...settings, ...patch });
    onSettingsChange?.(next);
    if (storage) void writeConversateSettings(storage, next);
  };
  const toggle = (
    key: "translation" | "inform" | "prepNote" | "copilot",
    label: string,
    disabled = false,
  ) => (
    <label>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={settings[key]}
        disabled={disabled}
        onChange={(event) => save({ [key]: event.target.checked })}
      />
    </label>
  );
  const saveKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!storage) return;
    const validated = validateOpenAiKey(candidate);
    if (!validated.ok || !await writeOpenAiKey(storage, validated.value)) {
      setKeyError(t("validationFailed"));
      return;
    }
    setCandidate("");
    setKeyError(undefined);
    onKeyChange?.(validated.value);
  };
  const saveSonioxKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!storage) return;
    const validated = validateSonioxKey(sonioxCandidate);
    if (!validated.ok || !await writeSonioxKey(storage, validated.value)) {
      setKeyError(t("validationFailed"));
      return;
    }
    setSonioxCandidate("");
    setKeyError(undefined);
    onSonioxKeyChange?.(validated.value);
  };
  return (
    <div className="phone-detail-stack">
      <section className="phone-panel phone-stacked-form">
        <a
          className="phone-key-link"
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
        >
          OpenAI API key · platform.openai.com ↗
        </a>
        {openAiKey ? (
          <div className="phone-key-status">
            <div><strong>{tc("openAiAnalysisKey")}</strong><span>{maskOpenAiKey(openAiKey)}</span></div>
            <button
              type="button"
              className="phone-danger-button"
              onClick={async () => {
                if (storage && await clearOpenAiKey(storage)) onKeyChange?.(undefined);
              }}
            >{t("delete")}</button>
          </div>
        ) : (
          <form className="phone-stacked-form" onSubmit={saveKey}>
            <label>
              <span>{tc("openAiAnalysisKey")}</span>
              <input
                type="password"
                autoComplete="off"
                value={candidate}
                onChange={(event) => setCandidate(event.target.value)}
              />
            </label>
            <button type="submit" className="phone-primary-button">{t("save")}</button>
          </form>
        )}
        {keyError && <p className="phone-ai-cost-warning">{keyError}</p>}
      </section>
      <section className="phone-panel phone-stacked-form">
        <p className="phone-ai-cost-warning">{tc("sonioxHint")}</p>
        <a
          className="phone-key-link"
          href="https://console.soniox.com/"
          target="_blank"
          rel="noreferrer"
        >
          Soniox ASR key · console.soniox.com ↗
        </a>
        {sonioxKey ? (
          <div className="phone-key-status">
            <div><strong>{tc("sonioxKey")}</strong><span>{maskSonioxKey(sonioxKey)}</span></div>
            <button
              type="button"
              className="phone-danger-button"
              onClick={async () => {
                if (storage && await clearSonioxKey(storage)) onSonioxKeyChange?.(undefined);
              }}
            >{t("delete")}</button>
          </div>
        ) : (
          <form className="phone-stacked-form" onSubmit={saveSonioxKey}>
            <label>
              <span>{tc("sonioxKey")}</span>
              <input
                type="password"
                autoComplete="off"
                value={sonioxCandidate}
                onChange={(event) => setSonioxCandidate(event.target.value)}
              />
            </label>
            <button type="submit" className="phone-primary-button">{t("save")}</button>
          </form>
        )}
      </section>
      <section className="phone-panel phone-choice-list">
        {toggle("translation", tc("translation"))}
        {toggle("inform", tc("inform"))}
        {toggle("prepNote", tc("prepNote"), !settings.inform)}
        {toggle("copilot", tc("copilot"))}
      </section>

      <section className="phone-panel phone-stacked-form">
        <label>
          <span>{tc("spokenLanguages")}</span>
          <input
            type="text"
            maxLength={120}
            value={settings.spokenLanguages}
            placeholder={tc("spokenLanguagesHelp")}
            onChange={(event) => save({ spokenLanguages: event.target.value })}
          />
        </label>
        <label>
          <span>{tc("transcriptionKeywords")}</span>
          <textarea
            rows={3}
            maxLength={1_000}
            value={settings.transcriptionKeywords}
            placeholder={tc("transcriptionKeywordsHelp")}
            onChange={(event) => save({ transcriptionKeywords: event.target.value })}
          />
        </label>
        <label>
          <span>{tc("prepNote")}</span>
          <textarea
            rows={5}
            maxLength={2_000}
            value={settings.prepNoteText}
            disabled={!settings.inform || !settings.prepNote}
            placeholder={tc("prepNoteHelp")}
            onChange={(event) => save({ prepNoteText: event.target.value })}
          />
        </label>
        <label>
          <span>{tc("goal")}</span>
          <textarea
            rows={3}
            maxLength={500}
            value={settings.goal}
            disabled={!settings.copilot}
            placeholder={tc("goalHelp")}
            onChange={(event) => save({ goal: event.target.value })}
          />
        </label>
        <label>
          <span>{tc("hideAfter")}</span>
          <input
            type="number"
            min={3}
            max={60}
            value={settings.informSeconds}
            disabled={!settings.inform}
            onChange={(event) => save({ informSeconds: Number(event.target.value) })}
          />
        </label>
      </section>

      <section className="phone-panel phone-ai-history">
        <h2>{tc("history")}</h2>
        {snapshot.history.length === 0 ? <p>{tc("noHistory")}</p> : (
          snapshot.history.map((record) => (
            <details key={record.id} className="phone-conversate-record">
              <summary>{new Date(record.endedAt).toLocaleString(locale)}</summary>
              {record.segments.map((segment) => (
                <p key={segment.id}>
                  <span>{segment.text}</span>
                  {segment.translation && <small>→ {segment.translation}</small>}
                </p>
              ))}
            </details>
          ))
        )}
        <button
          type="button"
          className="phone-danger-button"
          disabled={!storage || snapshot.history.length === 0}
          onClick={async () => {
            if (!storage || !await clearConversateHistory(storage)) return;
            onSnapshotChange?.({ ...snapshot, history: [] });
          }}
        >
          {tc("clearHistory")}
        </button>
      </section>
      <p className="phone-ai-cost-warning">{t("keyLocalOnly")}</p>
    </div>
  );
}

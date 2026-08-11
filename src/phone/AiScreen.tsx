import { useEffect, useState, type FormEvent } from "react";
import type { AiHudSnapshot } from "../ai-hud-state";
import {
  clearAiConversationHistory,
} from "../ai-history";
import { clearAiUsageLedger } from "../ai-cost";
import type { EvenStorage } from "../live-cache";
import {
  clearOpenAiKey,
  maskOpenAiKey,
  validateOpenAiKey,
  writeOpenAiKey,
} from "../openai-key";
import type { PhoneStringKey } from "../phone-i18n";
import { McpServersPanel } from "./McpServersPanel";
import { normalizeAiPresentationInterval } from "../ai-presentation-pacer";

function cost(value: number): string {
  return `$${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}`;
}

export function AiScreen({
  storage,
  openAiKey,
  snapshot,
  t,
  onKeyChange,
  onSnapshotChange,
  textIntervalMs = 200,
  onTextIntervalChange,
  onOpenByok,
}: {
  readonly storage?: EvenStorage;
  readonly openAiKey?: string;
  readonly snapshot: AiHudSnapshot;
  readonly t: (key: PhoneStringKey) => string;
  readonly onKeyChange?: (key: string | undefined) => void;
  readonly onSnapshotChange?: (snapshot: AiHudSnapshot) => void;
  readonly textIntervalMs?: number;
  readonly onTextIntervalChange?: (value: number) => void;
  readonly onOpenByok?: () => void;
}) {
  const [candidate, setCandidate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [intervalDraft, setIntervalDraft] = useState(
    normalizeAiPresentationInterval(textIntervalMs),
  );

  useEffect(() => {
    setIntervalDraft(normalizeAiPresentationInterval(textIntervalMs));
  }, [textIntervalMs]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!storage || busy) return;
    const validated = validateOpenAiKey(candidate);
    if (!validated.ok) {
      setError(t("validationFailed"));
      return;
    }
    setBusy(true);
    const saved = await writeOpenAiKey(storage, validated.value);
    setBusy(false);
    if (!saved) {
      setError(t("storageFailed"));
      return;
    }
    setCandidate("");
    setError(undefined);
    onKeyChange?.(validated.value);
    onSnapshotChange?.({
      ...snapshot,
      configured: true,
      phase: snapshot.phase === "unconfigured" ? "idle" : snapshot.phase,
      error: undefined,
    });
  };

  const removeKey = async () => {
    if (!storage || busy) return;
    setBusy(true);
    const cleared = await clearOpenAiKey(storage);
    setBusy(false);
    if (!cleared) {
      setError(t("storageFailed"));
      return;
    }
    onKeyChange?.(undefined);
    onSnapshotChange?.({
      ...snapshot,
      configured: false,
      phase: "unconfigured",
      error: undefined,
    });
  };

  const clearData = async () => {
    if (!storage || busy) return;
    setBusy(true);
    const [history, usage] = await Promise.all([
      clearAiConversationHistory(storage),
      clearAiUsageLedger(storage),
    ]);
    setBusy(false);
    if (!history || !usage) {
      setError(t("storageFailed"));
      return;
    }
    onSnapshotChange?.({
      ...snapshot,
      history: [],
      weekUsd: 0,
      monthUsd: 0,
      hasUnpricedUsage: false,
    });
    setError(undefined);
  };

  return (
    <div className="phone-detail-stack">
      <section className="phone-panel phone-key-intro">
        <h2>{t("openAiKey")}</h2>
        <p>{t("keyLocalOnly")}</p>
        <a
          className="phone-key-link"
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
        >
          Get an OpenAI API key ↗
        </a>
        <button type="button" className="phone-primary-button" onClick={onOpenByok}>
          Set up in BYOK Keys
        </button>
      </section>
      {openAiKey ? (
        <section className="phone-panel phone-key-status">
          <div>
            <span>{t("openAiKey")}</span>
            <strong>{maskOpenAiKey(openAiKey)}</strong>
          </div>
          <button
            type="button"
            className="phone-text-button"
            disabled={busy}
            onClick={() => void removeKey()}
          >
            {t("deleteKey")}
          </button>
        </section>
      ) : (
        <form className="phone-panel phone-stacked-form" onSubmit={(event) => void save(event)}>
          <label>
            <span>{t("openAiKey")}</span>
            <input
              type="password"
              autoComplete="off"
              value={candidate}
              disabled={busy}
              onChange={(event) => setCandidate(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="phone-primary-button"
            disabled={busy || !validateOpenAiKey(candidate).ok}
          >
            {t("save")}
          </button>
        </form>
      )}
      <section className="phone-panel phone-ai-speed">
        <label>
          <span>{t("responseSpeed")}</span>
          <strong>{intervalDraft} {t("millisecondsPerCharacter")}</strong>
          <input
            type="range"
            aria-label={t("responseSpeed")}
            min="100"
            max="1000"
            step="50"
            value={intervalDraft}
            onChange={(event) => {
              const next = normalizeAiPresentationInterval(
                Number(event.target.value),
              );
              setIntervalDraft(next);
              onTextIntervalChange?.(next);
            }}
          />
        </label>
      </section>
      <section className="phone-panel phone-ai-cost">
        <h2>{t("estimatedCost")}</h2>
        <div><span>{t("thisWeek")}</span><strong>{cost(snapshot.weekUsd)}</strong></div>
        <div><span>{t("thisMonth")}</span><strong>{cost(snapshot.monthUsd)}</strong></div>
        {snapshot.hasUnpricedUsage && (
          <p className="phone-ai-cost-warning">{t("unpricedUsage")}</p>
        )}
      </section>
      <section className="phone-panel phone-ai-history">
        <h2>{t("recentConversations")}</h2>
        {snapshot.history.length === 0 ? (
          <p>{t("noConversations")}</p>
        ) : snapshot.history.map((item) => (
          <article key={item.id}>
            <strong>{item.user || "—"}</strong>
            <p>{item.assistant || "—"}</p>
            {item.sources && item.sources.length > 0 && (
              <ul className="phone-ai-sources">
                {item.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
      <McpServersPanel storage={storage} t={t} />
      <button
        type="button"
        className="phone-danger-button"
        disabled={busy}
        onClick={() => void clearData()}
      >
        {t("clearAiData")}
      </button>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
    </div>
  );
}

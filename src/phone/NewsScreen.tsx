import { apiEndpoint } from "../api-endpoint";
import { useEffect, useState, type FormEvent } from "react";
import type { EvenStorage } from "../live-cache";
import type { PhoneStringKey } from "../phone-i18n";
import { PhoneIcon } from "../phone-icons";
import type { PhoneLocale } from "../phone-types";
import {
  addRssSource,
  deleteRssSource,
  resolveRssSources,
  updateRssSource,
  writeRssSources,
  type RssSource,
} from "../rss-sources";

export function NewsScreen({
  storage,
  locale,
  t,
  fetchImpl = fetch,
  onSourcesChange,
}: {
  readonly storage?: EvenStorage;
  readonly locale: PhoneLocale;
  readonly t: (key: PhoneStringKey) => string;
  readonly fetchImpl?: typeof fetch;
  readonly onSourcesChange?: (sources: readonly RssSource[]) => void;
}) {
  const [sources, setSources] = useState<readonly RssSource[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<string>();

  useEffect(() => {
    if (!storage) return;
    let active = true;
    void resolveRssSources(storage, locale).then((value) => {
      if (active) setSources(value);
    });
    return () => {
      active = false;
    };
  }, [locale, storage]);

  const commit = async (next: readonly RssSource[]) => {
    if (!storage || busy) return false;
    setBusy(true);
    const saved = await writeRssSources(storage, next, locale);
    if (saved) {
      setSources(next);
      onSourcesChange?.(next);
      setError(undefined);
    } else {
      setError(t("storageFailed"));
    }
    setBusy(false);
    return saved;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const candidate = addRssSource(sources, name, url);
      const response = await fetchImpl(
        apiEndpoint(`/api/news?url=${encodeURIComponent(candidate.at(-1)!.url)}`),
        { headers: { accept: "application/xml,text/xml" } },
      );
      if (!response.ok) throw new Error("feed_validation");
      const saved = storage
        ? await writeRssSources(storage, candidate, locale)
        : false;
      if (!saved) throw new Error("storage");
      setSources(candidate);
      onSourcesChange?.(candidate);
      setName("");
      setUrl("");
      setError(undefined);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "";
      setError(
        code === "rss_source_limit"
          ? t("sourceLimit")
          : code === "storage"
            ? t("storageFailed")
            : t("validationFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="phone-detail-stack">
      <section className="phone-panel phone-source-list">
        {sources.map((source) => (
          <div className="phone-source-row" key={source.id}>
            {editing === source.id ? (
              <input
                autoFocus
                className="phone-source-name-input"
                aria-label={`${t("sourceName")} ${source.name}`}
                defaultValue={source.name}
                maxLength={40}
                onBlur={(event) => {
                  try {
                    void commit(updateRssSource(
                      sources,
                      source.id,
                      { name: event.target.value },
                    ));
                  } catch {
                    setError(t("validationFailed"));
                  }
                  setEditing(undefined);
                }}
              />
            ) : (
              <button
                type="button"
                className="phone-toggle-row"
                aria-pressed={source.enabled}
                disabled={busy}
                onClick={() => void commit(updateRssSource(
                  sources,
                  source.id,
                  { enabled: !source.enabled },
                ))}
              >
                <span>{source.name}</span>
                <small>{source.enabled ? t("enabled") : t("disabled")}</small>
              </button>
            )}
            <div className="phone-source-actions">
              <button
                type="button"
                className="phone-icon-button"
                aria-label={`${t("edit")} ${source.name}`}
                disabled={busy}
                onClick={() => setEditing(source.id)}
              >
                <PhoneIcon name="edit" size={20} />
              </button>
              {!source.isDefault && (
                <button
                  type="button"
                  className="phone-icon-button"
                  aria-label={`${t("delete")} ${source.name}`}
                  disabled={busy}
                  onClick={() => void commit(deleteRssSource(
                    sources,
                    source.id,
                  ))}
                >
                  <PhoneIcon name="trash" size={20} />
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
      <form className="phone-panel phone-stacked-form" onSubmit={(event) => void submit(event)}>
        <h2>{t("addSource")}</h2>
        <label>
          <span>{t("sourceName")}</span>
          <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>{t("sourceUrl")}</span>
          <input
            value={url}
            type="url"
            inputMode="url"
            placeholder="https://"
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <button type="submit" className="phone-primary-button" disabled={busy || !name.trim() || !url.trim()}>
          <PhoneIcon name="plus" size={22} />
          {t("add")}
        </button>
      </form>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
    </div>
  );
}

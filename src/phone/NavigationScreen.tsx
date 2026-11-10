import { KeySetupHelp } from "./KeySetupHelp";
import type { PhoneLocale } from "../phone-types";
import { apiEndpoint } from "../api-endpoint";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { EvenStorage } from "../live-cache";
import type { PhoneStringKey } from "../phone-i18n";
import {
  clearOrsKey,
  maskOrsKey,
  orsHeaders,
  resolveOrsKey,
  validateOrsKey,
  writeOrsKey,
} from "../ors-key";
import { clearActiveRouteCache } from "../navigation";

export function NavigationScreen({
  storage,
  locale = "en",
  routeControls,
  t,
  fetchImpl = fetch,
  serverConfigured = false,
  onKeyChange,
  onDeleteRoute,
}: {
  readonly locale?: PhoneLocale;
  readonly storage?: EvenStorage;
  readonly routeControls: ReactNode;
  readonly t: (key: PhoneStringKey) => string;
  readonly fetchImpl?: typeof fetch;
  readonly serverConfigured?: boolean;
  readonly onKeyChange?: (key: string | undefined) => void;
  readonly onDeleteRoute?: () => void | Promise<void>;
}) {
  const [storedKey, setStoredKey] = useState<string>();
  const [candidate, setCandidate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!storage) return;
    let active = true;
    void resolveOrsKey(storage).then((value) => {
      if (!active) return;
      setStoredKey(value);
      onKeyChange?.(value);
    });
    return () => {
      active = false;
    };
  }, [storage]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!storage || busy) return;
    const validation = validateOrsKey(candidate);
    if (!validation.ok) {
      setError(t("validationFailed"));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetchImpl(apiEndpoint("/api/routing-key-test"), {
        method: "POST",
        headers: {
          accept: "application/json",
          ...orsHeaders(validation.value),
        },
      });
      if (!response.ok) throw new Error("invalid");
      if (!await writeOrsKey(storage, validation.value)) {
        throw new Error("storage");
      }
      setStoredKey(validation.value);
      setCandidate("");
      onKeyChange?.(validation.value);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === "storage"
          ? t("storageFailed")
          : t("validationFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!storage || busy) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setError(t("confirmDelete"));
      return;
    }
    setBusy(true);
    try {
      if (!await clearActiveRouteCache(storage)) throw new Error("storage");
      if (!await clearOrsKey(storage)) throw new Error("storage");
      setStoredKey(undefined);
      setConfirmDelete(false);
      setError(undefined);
      onKeyChange?.(undefined);
      try {
        await onDeleteRoute?.();
      } catch {
        // Removing a device-local secret must not depend on a live route session.
      }
    } catch {
      setError(t("storageFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (storedKey || serverConfigured) {
    return (
      <div className="phone-detail-stack">
        <section className="phone-panel phone-key-status">
          <div>
            <span>{t("orsKey")}</span>
            <strong>
              {storedKey ? maskOrsKey(storedKey) : t("developmentFallback")}
            </strong>
          </div>
          <span>{t("connected")}</span>
        </section>
        {routeControls}
        {storedKey && (
          <button
            type="button"
            className="phone-danger-button"
            disabled={busy}
            onClick={() => void remove()}
          >
            {t("deleteKey")}
          </button>
        )}
        {error && <p role="alert" className="phone-form-message">{error}</p>}
      </div>
    );
  }

  return (
    <div className="phone-detail-stack">
      <KeySetupHelp locale={locale} provider="ors" />
      <section className="phone-panel phone-key-intro">
        <h2>{t("orsKey")}</h2>
        <p>{t("keyLocalOnly")}</p>
      </section>
      <form className="phone-panel phone-stacked-form" onSubmit={(event) => void submit(event)}>
        <label>
          <span>{t("orsKey")}</span>
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
          disabled={busy || !validateOrsKey(candidate).ok}
        >
          {t("validateKey")}
        </button>
      </form>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
    </div>
  );
}

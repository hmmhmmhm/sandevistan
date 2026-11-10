import { useEffect, useRef, useState } from "react";
import { readCache, writeCache, type EvenStorage } from "../live-cache";
export type PhoneTheme = "system" | "light" | "dark";
function isPhoneTheme(value: unknown): value is PhoneTheme { return value === "system" || value === "light" || value === "dark"; }
const QUERY = "(prefers-color-scheme: dark)";
export function usePhoneTheme(storage?: EvenStorage) {
  const [setting, setSetting] = useState<PhoneTheme>("system");
  const [systemDark, setSystemDark] = useState(() => globalThis.matchMedia?.(QUERY).matches ?? false);
  const [error, setError] = useState(false);
  const revision = useRef(0), writes = useRef(Promise.resolve()), mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const query = globalThis.matchMedia?.(QUERY);
    const changed = () => setSystemDark(query?.matches ?? false);
    changed(); query?.addEventListener("change", changed);
    return () => { mounted.current = false; query?.removeEventListener("change", changed); };
  }, []);
  useEffect(() => {
    let current = true; const at = revision.current;
    if (storage && at > 0) {
      writes.current = writes.current.then(async () => {
        const saved = await writeCache(storage, "phone-theme", setting);
        if (current && mounted.current && at === revision.current) setError(!saved);
      });
    } else if (storage) void readCache(storage, "phone-theme", isPhoneTheme).then(value => {
      if (current && at === revision.current && value) setSetting(value);
    });
    return () => { current = false; };
  }, [storage]);
  const resolved = setting === "system" ? systemDark ? "dark" : "light" : setting;
  useEffect(() => {
    const root = document.documentElement, previous = root.getAttribute("data-phone-theme");
    root.setAttribute("data-phone-theme", resolved);
    return () => { if (previous === null) root.removeAttribute("data-phone-theme"); else root.setAttribute("data-phone-theme", previous); };
  }, [resolved]);
  const choose = (next: PhoneTheme) => {
    const at = ++revision.current; setSetting(next); setError(false);
    if (storage) writes.current = writes.current.then(async () => {
      const saved = await writeCache(storage, "phone-theme", next);
      if (mounted.current && at === revision.current) setError(!saved);
    });
  };
  return { setting, resolved, error, choose };
}

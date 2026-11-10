import type { ConversateInform, ConversateSnapshot, ConversateSuggestion } from "./conversate-state";
export function createConversateCues(options: {
  snapshot(): ConversateSnapshot;
  publish(patch: Partial<ConversateSnapshot>): void;
  seconds(): number;
}) {
  let informTimer: ReturnType<typeof setTimeout> | undefined;
  let copilotTimer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Set<string>();
  const rememberExpiry = (id: string) => { expired.add(id); while (expired.size > 200) expired.delete(expired.values().next().value ?? ""); };
  return {
    inform(inform: ConversateInform, show: boolean) {
      const current = options.snapshot(), previous = current.informs.find(i => i.id === inform.id);
      const stored = { ...inform, at: previous?.at ?? inform.at };
      const active = show && !expired.has(inform.id) ? { ...stored,
        expiresAt: current.activeInform?.id === inform.id && current.activeInform.expiresAt
          ? current.activeInform.expiresAt : Date.now() + options.seconds() * 1000 } : undefined;
      options.publish({ informs: [stored, ...current.informs.filter(i => i.id !== stored.id)].slice(0, 20), ...(active ? { activeInform: active } : {}) });
      if (active) {
        clearTimeout(informTimer);
        informTimer = setTimeout(() => {
          rememberExpiry(active.id);
          if (options.snapshot().activeInform?.id === active.id) options.publish({ activeInform: undefined });
        }, Math.max(0, active.expiresAt - Date.now()));
      }
    },
    copilot(id: string, suggestions: readonly ConversateSuggestion[], show: boolean) {
      if (!suggestions.length) return;
      const current = options.snapshot(), previous = current.copilotHistory?.find(c => c.id === id);
      const record = { id, at: previous?.at ?? new Date().toISOString(), suggestions: suggestions.slice(0, 3) };
      const history = [record, ...(current.copilotHistory ?? []).filter(c => c.id !== id)].slice(0, 20);
      if (!show || expired.has(id)) { options.publish({ copilotHistory: history }); return; }
      const expiresAt = current.activeCopilotId === id && current.copilotExpiresAt ? current.copilotExpiresAt : Date.now() + options.seconds() * 1000;
      options.publish({ copilotHistory: history, activeCopilotId: id, copilotExpiresAt: expiresAt, suggestions: record.suggestions, selectedSuggestion: 0 });
      clearTimeout(copilotTimer);
      copilotTimer = setTimeout(() => {
        rememberExpiry(id);
        if (options.snapshot().activeCopilotId === id) options.publish({ suggestions: [], activeCopilotId: undefined, copilotExpiresAt: undefined });
      }, Math.max(0, expiresAt - Date.now()));
    },
    dispose() { clearTimeout(informTimer); clearTimeout(copilotTimer); expired.clear(); },
  };
}

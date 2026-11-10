import type { ConversateInform, ConversateSnapshot, ConversateSuggestion, ConversateSettings } from "./conversate-state";

export type ConversateCopilotRecord = { readonly id: string; readonly at: string; readonly suggestions: readonly ConversateSuggestion[] };
export type ConversateDirectory =
  | { readonly mode: "list"; readonly selectedId?: string }
  | { readonly mode: "inform"; readonly id: string; readonly row: number }
  | { readonly mode: "copilot"; readonly id: string; readonly suggestion: number };
export type ConversateDirectoryEntry =
  | { readonly kind: "inform"; readonly id: string; readonly at: string; readonly inform: ConversateInform }
  | { readonly kind: "copilot"; readonly id: string; readonly at: string; readonly copilot: ConversateCopilotRecord };
export function conversateDirectoryEntries(snapshot: ConversateSnapshot, settings?: Pick<ConversateSettings,"inform" | "copilot">): readonly ConversateDirectoryEntry[] {
  const informs: ConversateDirectoryEntry[] = snapshot.informs.map(inform => ({ kind: "inform", id: inform.id, at: inform.at, inform }));
  const copilots: ConversateDirectoryEntry[] = (snapshot.copilotHistory ?? []).map(copilot => ({ kind: "copilot", id: copilot.id, at: copilot.at, copilot }));
  return [...informs, ...copilots].filter(entry => !settings || settings[entry.kind]).sort((a,b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}
export function tapConversateDirectory(snapshot: ConversateSnapshot, settings?: Pick<ConversateSettings,"inform" | "copilot">): Partial<ConversateSnapshot> {
  const view = snapshot.directory;
  if (view?.mode === "list") {
    const entries = conversateDirectoryEntries(snapshot,settings);
    const selected = entries.find(e => e.id === view.selectedId) ?? entries[0];
    return { directory: selected?.kind === "inform" ? { mode: "inform", id: selected.id, row: 0 }
      : selected ? { mode: "copilot", id: selected.id, suggestion: 0 } : undefined };
  }
  return { directory: snapshot.directory ? undefined : { mode: "list", selectedId: conversateDirectoryEntries(snapshot,settings)[0]?.id } };
}
export function scrollConversateDirectory(snapshot: ConversateSnapshot, delta: -1 | 1, settings?: Pick<ConversateSettings,"inform" | "copilot">, informLineCount = 4): Partial<ConversateSnapshot> {
  const view = snapshot.directory;
  if (!view) return {};
  const entries = conversateDirectoryEntries(snapshot,settings);
  if (view.mode === "list") {
    const index = Math.max(0, entries.findIndex(e => e.id === view.selectedId));
    return { directory: { mode: "list", selectedId: entries[Math.max(0, Math.min(entries.length - 1, index + delta))]?.id } };
  }
  if (view.mode === "copilot") {
    const record = (snapshot.copilotHistory ?? []).find(c => c.id === view.id);
    return { directory: { ...view, suggestion: Math.max(0, Math.min((record?.suggestions.length ?? 1) - 1, view.suggestion + delta)) } };
  }
  return { directory: { ...view, row: Math.max(0, Math.min(Math.max(0,informLineCount-4),view.row + delta)) } };
}

import {
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from "@evenrealities/even_hub_sdk";
import type { ConversateSettings, ConversateSnapshot } from "./conversate-state";
import { translateConversate } from "./conversate-i18n";
import type { PhoneLocale } from "./phone-types";

export type NativeConversateContent = { readonly inform: string; readonly body: string };
export type NativeConversateUpdatePriority = "analysis" | "transcript" | "input";

export const CONVERSATE_TEXT_INTERVAL_MS = 120;

const boundedLine = (value: string, length: number) => value
  .replace(/\s+/g, " ").trim().slice(0, length);

export function createNativeConversateContent(
  snapshot: ConversateSnapshot,
  locale: PhoneLocale,
  settings: ConversateSettings,
): NativeConversateContent {
  const historyInform = snapshot.informHistoryOpen
    ? snapshot.informs[snapshot.selectedInform]
    : undefined;
  const inform = snapshot.error
    ? boundedLine(snapshot.error, 160)
    : historyInform
      ? `${translateConversate(locale, "informHistory")} ${snapshot.selectedInform + 1}/${snapshot.informs.length} · ${boundedLine(historyInform.text, 150)}`
      : boundedLine(snapshot.activeInform?.text ?? "", 160);
  const lastIndex = Math.max(0, snapshot.segments.length - 1 - snapshot.transcriptOffset);
  const segmentCount = snapshot.partial || snapshot.suggestions.length ? 1 : 2;
  const visibleSegments = snapshot.segments.slice(
    Math.max(0, lastIndex - segmentCount + 1),
    lastIndex + 1,
  );
  const recent = visibleSegments.flatMap((segment) => [
    boundedLine(segment.text, 260),
    ...(settings.translation && segment.translation
      ? [`→ ${boundedLine(segment.translation, 220)}`] : []),
  ]);
  if (snapshot.partial && snapshot.transcriptOffset === 0) {
    recent.push(boundedLine(snapshot.partial, 260));
  }
  const suggestion = snapshot.suggestions[snapshot.selectedSuggestion];
  if (suggestion) recent.push(
    "",
    `${snapshot.copilotOpen ? ">" : "·"} ${snapshot.selectedSuggestion + 1}/${snapshot.suggestions.length} ${boundedLine(suggestion.style, 24)} · ${boundedLine(suggestion.original, 150)}`,
    snapshot.copilotOpen
      ? `${translateConversate(locale, "pronunciation")}: ${boundedLine(suggestion.pronunciation, 120)}`
      : `${boundedLine(suggestion.pronunciation, 70)} · ${boundedLine(suggestion.meaning, 100)}`,
    ...(snapshot.copilotOpen
      ? [`${translateConversate(locale, "meaning")}: ${boundedLine(suggestion.meaning, 140)}`]
      : []),
  );
  if (!recent.length && snapshot.phase === "listening") {
    recent.push(translateConversate(locale, "listening"));
  }
  return { inform, body: recent.join("\n").slice(-1_200) };
}

type Bridge = {
  rebuildPageContainer(page: RebuildPageContainer): Promise<boolean>;
  textContainerUpgrade(update: TextContainerUpgrade): Promise<boolean>;
};

const TEXT_ID = 1;
const TEXT_NAME = "conversateText";
const visibleText = (content: NativeConversateContent) =>
  [content.inform, content.body].filter(Boolean).join("\n\n") || " ";

function page(content: NativeConversateContent) {
  return new RebuildPageContainer({
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: 576, height: 288,
        borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 8,
        containerID: TEXT_ID, containerName: TEXT_NAME,
        content: visibleText(content), isEventCapture: 1,
      }),
    ],
  });
}

export function createNativeConversateMode(options: {
  readonly bridge: Bridge;
  readonly createImagePage: () => RebuildPageContainer;
  readonly now?: () => number;
  readonly wait?: (milliseconds: number) => Promise<void>;
}) {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  let active = false;
  let busy = false;
  let last: NativeConversateContent | undefined;
  let lastUpgradeAt = 0;
  let sequence = 0;
  let lastAppliedSequence = 0;
  const pending = new Map<NativeConversateUpdatePriority, {
    readonly content: NativeConversateContent;
    readonly sequence: number;
  }>();
  const takePending = () => {
    for (const priority of ["input", "transcript", "analysis"] as const) {
      const queued = pending.get(priority);
      if (queued && queued.sequence > lastAppliedSequence) {
        pending.delete(priority);
        return { ...queued, priority };
      }
      pending.delete(priority);
    }
    return undefined;
  };
  const update = async (
    content: NativeConversateContent,
    priority: NativeConversateUpdatePriority = "transcript",
  ) => {
    if (!active) return false;
    const queued = { content, sequence: ++sequence };
    if (busy) {
      pending.set(priority, queued);
      return true;
    }
    busy = true;
    try {
      let next: (typeof queued & { priority: NativeConversateUpdatePriority }) | undefined = {
        ...queued,
        priority,
      };
      while (active && next) {
        if (next.priority !== "input" && lastUpgradeAt) {
          const remaining = CONVERSATE_TEXT_INTERVAL_MS - (now() - lastUpgradeAt);
          if (remaining > 0) await wait(remaining);
        }
        const unchanged = visibleText(next.content) === (last && visibleText(last));
        const succeeded = unchanged || await options.bridge.textContainerUpgrade(
          new TextContainerUpgrade({
            containerID: TEXT_ID,
            containerName: TEXT_NAME,
            content: visibleText(next.content),
          }),
        );
        if (!succeeded) return false;
        if (!unchanged) lastUpgradeAt = now();
        last = next.content;
        lastAppliedSequence = next.sequence;
        next = takePending();
      }
      return true;
    } finally { busy = false; }
  };
  return {
    active: () => active,
    async enter(content: NativeConversateContent) {
      if (active) return update(content);
      if (busy) return false;
      busy = true;
      try {
        const entered = await options.bridge.rebuildPageContainer(page(content));
        if (entered) {
          active = true;
          last = content;
          lastUpgradeAt = 0;
          pending.clear();
        }
        return entered;
      } finally { busy = false; }
    },
    update,
    async leave() {
      if (!active || busy) return false;
      busy = true;
      try {
        const left = await options.bridge.rebuildPageContainer(options.createImagePage());
        if (left) {
          active = false;
          last = undefined;
          pending.clear();
        }
        return left;
      } finally { busy = false; }
    },
    dispose() { active = false; last = undefined; pending.clear(); },
  };
}

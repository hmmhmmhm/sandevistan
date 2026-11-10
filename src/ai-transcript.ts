import type { AiConversationTurn } from "./ai-realtime-protocol";
import { wrapHudText } from "./fast-detail-text";

const MAXIMUM_LINE_UNITS = 46;
export const AI_TRANSCRIPT_VISIBLE_LINES = 9;

function roleLines(label: "YOU" | "AI", text: string): readonly string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const prefix = `${label} // `;
  const continuation = " ".repeat(prefix.length);
  return wrapHudText(
    normalized,
    MAXIMUM_LINE_UNITS - prefix.length,
    1024,
  ).map((line, index) => `${index === 0 ? prefix : continuation}${line}`);
}

export function createAiTranscriptLines(
  completed: readonly AiConversationTurn[],
  current: AiConversationTurn,
): readonly string[] {
  const turns = current.user.trim() || current.assistant.trim()
    ? [...completed, current]
    : completed;
  return turns.flatMap((turn) => [
    ...roleLines("YOU", turn.user),
    ...roleLines("AI", turn.assistant),
  ]);
}

type TranscriptSpeaker = "YOU" | "AI" | undefined;

function transcriptSpeakers(
  lines: readonly string[],
): readonly TranscriptSpeaker[] {
  let current: TranscriptSpeaker;
  return lines.map((line) => {
    if (line.startsWith("YOU // ")) current = "YOU";
    else if (line.startsWith("AI // ")) current = "AI";
    return current;
  });
}

function displayRows(
  lines: readonly string[],
  speakers: readonly TranscriptSpeaker[],
  startLine: number,
  endLine: number,
): readonly string[] {
  const rows: string[] = [];
  for (let index = startLine; index <= endLine; index += 1) {
    if (
      index > startLine
      && speakers[index - 1] !== undefined
      && speakers[index] !== undefined
      && speakers[index - 1] !== speakers[index]
    ) {
      rows.push("");
    }
    rows.push(lines[index]);
  }
  return rows;
}

export function selectAiTranscriptDisplayRows(
  lines: readonly string[],
  selectedLine: number,
  visibleRows = AI_TRANSCRIPT_VISIBLE_LINES,
): readonly string[] {
  const maximumRows = Math.max(0, Math.floor(visibleRows));
  if (lines.length === 0 || maximumRows <= 0) return [];

  const endLine = Math.min(
    Math.max(0, Math.floor(selectedLine)),
    lines.length - 1,
  );
  const speakers = transcriptSpeakers(lines);
  let startLine = endLine;
  let rowCount = 1;
  while (startLine > 0) {
    const previousLine = startLine - 1;
    const includesSpeakerGap = speakers[previousLine] !== undefined
      && speakers[startLine] !== undefined
      && speakers[previousLine] !== speakers[startLine];
    const additionalRows = includesSpeakerGap ? 2 : 1;
    if (rowCount + additionalRows > maximumRows) break;
    rowCount += additionalRows;
    startLine = previousLine;
  }
  return displayRows(lines, speakers, startLine, endLine);
}

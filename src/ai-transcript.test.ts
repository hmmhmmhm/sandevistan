import { describe, expect, it } from "vitest";
import {
  createAiTranscriptLines,
  selectAiTranscriptDisplayRows,
} from "./ai-transcript";

describe("Ask AI transcript lines", () => {
  it("returns one chronological stream of wrapped role lines", () => {
    expect(createAiTranscriptLines(
      [{ user: "Earlier question", assistant: "Earlier answer" }],
      { user: "Current question", assistant: "Current answer" },
    )).toEqual([
      "YOU // Earlier question",
      "AI // Earlier answer",
      "YOU // Current question",
      "AI // Current answer",
    ]);
  });

  it("wraps long answers without grouping them into six-line pages", () => {
    const lines = createAiTranscriptLines(
      [],
      {
        user: "Question",
        assistant: "streaming response ".repeat(80),
      },
    );

    expect(lines[0]).toBe("YOU // Question");
    expect(lines[1]).toContain("AI // streaming response");
    expect(lines.length).toBeGreaterThan(6);
    expect(lines.every((line) => !line.includes("\n"))).toBe(true);
  });

  it("wraps conservatively for the Canvas body width", () => {
    const assistant = "x".repeat(48);
    const lines = createAiTranscriptLines([], { user: "", assistant });

    expect(lines).toEqual([`AI // ${"x".repeat(40)}`, `      ${"x".repeat(8)}`]);
  });

  it("adds one display-only row between speakers", () => {
    const rows = selectAiTranscriptDisplayRows([
      "YOU // question",
      "AI // answer one",
      "      answer two",
      "YOU // follow-up",
    ], 3, 6);

    expect(rows).toEqual([
      "YOU // question",
      "",
      "AI // answer one",
      "      answer two",
      "",
      "YOU // follow-up",
    ]);
  });

  it("keeps blank speaker gaps out of the scroll line count", () => {
    const lines = [
      "YOU // question",
      "AI // answer one",
      "      answer two",
      "YOU // follow-up",
    ];

    expect(selectAiTranscriptDisplayRows(lines, 2, 4)).toEqual([
      "YOU // question",
      "",
      "AI // answer one",
      "      answer two",
    ]);
  });

  it("ignores an empty live turn", () => {
    expect(createAiTranscriptLines(
      [{ user: "Hello", assistant: "Hi" }],
      { user: "  ", assistant: "" },
    )).toEqual([
      "YOU // Hello",
      "AI // Hi",
    ]);
  });
});

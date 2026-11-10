import { expect, it, vi } from "vitest";
import { createRealtimeTranscriptInput } from "./ai-realtime-transcript-input";
const completed = (id: string, transcript = "질문") => ({
  type: "conversation.item.input_audio_transcription.completed", item_id: id, transcript,
});
it("replaces delayed audio in place without answering an older or cancelled turn", () => {
  const send = vi.fn();
  const input = createRealtimeTranscriptInput(send);
  input.handle(completed("old"), "latest", false);
  expect(send.mock.calls.map(([event]) => event.type)).toEqual(["conversation.item.create", "conversation.item.delete"]);
  send.mockClear();
  input.handle(completed("latest"), "latest", true);
  expect(send.mock.calls.map(([event]) => event.type)).not.toContain("response.create");
});
it("ignores duplicate, partial, malformed and empty transcriptions and resets for reconnect", () => {
  const send = vi.fn();
  const input = createRealtimeTranscriptInput(send);
  for (const event of [null, {}, { type: "conversation.item.input_audio_transcription.delta" }, completed("empty", " ")]) input.handle(event, "turn", false);
  expect(send).not.toHaveBeenCalled();
  input.handle(completed("turn"), "turn", false);
  input.handle(completed("turn"), "turn", false);
  expect(send).toHaveBeenCalledTimes(3);
  input.reset();
  input.handle(completed("turn"), "turn", false);
  expect(send).toHaveBeenCalledTimes(6);
});

// Keep the model's user input identical to the transcript shown on the glasses.
export function createRealtimeTranscriptInput(send: (event: unknown) => void) {
  const completed = new Set<string>();
  return {
    reset() { completed.clear(); },
    handle(event: unknown, activeItemId: string | undefined, suppressed: boolean) {
      if (!event || typeof event !== "object" || !("type" in event)
        || event.type !== "conversation.item.input_audio_transcription.completed"
        || !("item_id" in event) || typeof event.item_id !== "string"
        || !("transcript" in event) || typeof event.transcript !== "string"
        || completed.has(event.item_id)) return;
      completed.add(event.item_id);
      if (completed.size > 200) completed.delete(completed.values().next().value ?? "");
      const text = event.transcript.trim().slice(0, 4_000);
      if (!text) return;
      // Insert beside the audio item before removing it, preserving conversation order.
      send({ type: "conversation.item.create", previous_item_id: event.item_id,
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
      send({ type: "conversation.item.delete", item_id: event.item_id });
      if (event.item_id === activeItemId && !suppressed) send({ type: "response.create" });
    },
  };
}

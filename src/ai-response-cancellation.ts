export function createAiResponseCancellation(send: (event: unknown) => void) {
  let sequence = 0;
  const pending = new Set<string>();
  return {
    reset() { pending.clear(); },
    cancel(responseId: string) {
      const eventId = `cancel_${++sequence}`; pending.add(eventId);
      while (pending.size > 32) pending.delete(pending.values().next().value ?? "");
      send({ type:"response.cancel",response_id:responseId,event_id:eventId });
    },
    consumeExpectedError(event: unknown) {
      if (!event || typeof event !== "object" || !("type" in event) || event.type !== "error"
        || !("error" in event) || !event.error || typeof event.error !== "object") return false;
      const error = event.error;
      if (!("code" in error) || error.code !== "response_cancel_not_active"
        || !("event_id" in error) || typeof error.event_id !== "string" || !pending.has(error.event_id)) return false;
      pending.delete(error.event_id); return true;
    },
  };
}

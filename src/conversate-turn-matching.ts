type Stream = "live" | "refinement";
type Turn = { liveId?: string; refinedText?: string };
const MAX_PENDING_TURNS = 200;

export function createConversateTurnMatcher(
  onRefined: (itemId: string, text: string) => void,
) {
  let sequence = 0;
  const pending: Record<Stream, number[]> = { live: [], refinement: [] };
  const items: Record<Stream, Map<string, number>> = {
    live: new Map(), refinement: new Map(),
  };
  const turns = new Map<number, Turn>();

  const prune = () => {
    const minimum = sequence - MAX_PENDING_TURNS;
    for (const stream of ["live", "refinement"] as const) {
      pending[stream] = pending[stream].filter((turn) => turn > minimum);
      for (const [id, turn] of items[stream]) {
        if (turn <= minimum) items[stream].delete(id);
      }
    }
    for (const turn of turns.keys()) {
      if (turn <= minimum) turns.delete(turn);
    }
  };

  return {
    commit() {
      sequence += 1;
      turns.set(sequence, {});
      pending.live.push(sequence);
      pending.refinement.push(sequence);
      prune();
    },
    acknowledge(stream: Stream, itemId: string) {
      if (items[stream].has(itemId)) return;
      const turn = pending[stream].shift();
      if (turn !== undefined) items[stream].set(itemId, turn);
    },
    complete(stream: Stream, itemId: string, text: string) {
      const sequence = items[stream].get(itemId);
      if (sequence === undefined) return;
      const turn = turns.get(sequence);
      if (!turn) return;
      if (stream === "live") turn.liveId = itemId;
      else turn.refinedText = text;
      if (turn.liveId && turn.refinedText) {
        turns.delete(sequence);
        onRefined(turn.liveId, turn.refinedText);
      }
    },
  };
}

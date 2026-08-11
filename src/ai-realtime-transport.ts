export type RealtimeSocket = {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(value: string | ArrayBufferLike | ArrayBufferView): void;
  close(): void;
};

export function createDefaultRealtimeSocket(
  url: string,
  protocols: string[],
): RealtimeSocket {
  return new WebSocket(url, protocols) as unknown as RealtimeSocket;
}

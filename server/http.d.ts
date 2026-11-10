export function createTimeout(milliseconds: number, setTimeoutImpl?: typeof setTimeout, clearTimeoutImpl?: typeof clearTimeout, parentSignal?: AbortSignal): { signal: AbortSignal; dispose(): void };
export function jsonResponse(body: unknown, init?: ResponseInit): Response;
export function readLimitedBytes(response: Pick<Response, "body">, maxBytes: number): Promise<Uint8Array>;
export function readLimitedRequestJson(request: Request, maxBytes: number, options?: { allowEmpty?: boolean }): Promise<unknown>;
export function readOpenAiTextStream(response: Response, onText: (text: string) => void): Promise<unknown>;

export function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function readLimitedBytes(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }

  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readLimitedRequestJson(request, maxBytes, { allowEmpty = false } = {}) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  let bytes;
  try {
    bytes = await readLimitedBytes(request, maxBytes);
  } catch (error) {
    if (error instanceof Error && error.message === "RESPONSE_TOO_LARGE") {
      throw new Error("REQUEST_TOO_LARGE");
    }
    throw error;
  }
  if (allowEmpty && bytes.byteLength === 0) return undefined;
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function createTimeout(
  milliseconds,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  parentSignal,
) {
  const controller = new AbortController();
  const cancel = () => controller.abort(parentSignal?.reason);
  parentSignal?.addEventListener("abort", cancel, { once: true });
  if (parentSignal?.aborted) cancel();
  const timer = setTimeoutImpl(() => controller.abort(), milliseconds);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeoutImpl(timer);
      parentSignal?.removeEventListener("abort", cancel);
    },
  };
}

export async function readOpenAiTextStream(response, onText) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("EMPTY_STREAM");
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let bytes = 0;
  let completed;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 524_288) throw new Error("RESPONSE_TOO_LARGE");
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trimEnd();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data);
        if (event.type === "error" || event.type === "response.failed" || event.type === "response.incomplete") throw new Error("UPSTREAM_STREAM_FAILED");
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
          if (text.length > 64_000) throw new Error("RESPONSE_TOO_LARGE");
          onText(text);
        }
        if (event.type === "response.completed") completed = event.response;
      }
    }
    if (!completed) throw new Error("INCOMPLETE_STREAM");
    return completed;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

import { handleApiRequest } from "./api-router.js";
import { jsonResponse } from "./http.js";

async function readRequestBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > 32_000) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function requestHeaders(incoming) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

function configureLocalApi(server) {
  server.middlewares.use(async (incoming, outgoing, next) => {
    if (!incoming.url?.startsWith("/api/")) {
      next();
      return;
    }
    let response;
    try {
      const method = incoming.method ?? "GET";
      const host = incoming.headers.host ?? "127.0.0.1";
      const body = method === "GET" || method === "HEAD"
        ? undefined
        : await readRequestBody(incoming);
      const request = new Request(
        new URL(incoming.url ?? "/", `http://${host}`),
        {
          method,
          headers: requestHeaders(incoming),
          body,
        },
      );

      response = await handleApiRequest(request, process.env);
    } catch (error) {
      const tooLarge = error instanceof Error
        && error.message === "REQUEST_TOO_LARGE";
      response = jsonResponse(
        {
          error: {
            code: tooLarge ? "REQUEST_TOO_LARGE" : "INTERNAL_ERROR",
            message: tooLarge ? "Request body is too large" : "SANDEVISTAN API failed",
          },
        },
        { status: tooLarge ? 413 : 500 },
      );
    }
    if (!response) {
      next();
      return;
    }

    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => {
      outgoing.setHeader(name, value);
    });
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
}

export function sandevistanDevApi() {
  return {
    name: "sandevistan-dev-api",
    configureServer: configureLocalApi,
    configurePreviewServer: configureLocalApi,
  };
}

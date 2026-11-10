import { expect, it } from "vitest";
import { apiEndpoint } from "./api-endpoint";
it("keeps local and Sites requests same-origin by default", () => {
  expect(apiEndpoint("/api/news?feed=bbc-world", "")).toBe("/api/news?feed=bbc-world");
});
it("routes packaged API requests to the configured public Worker", () => {
  expect(apiEndpoint("/api/map?lat=37.5&lng=127", "https://sandevistan-api.hmmhmmhm.workers.dev"))
    .toBe("https://sandevistan-api.hmmhmmhm.workers.dev/api/map?lat=37.5&lng=127");
});

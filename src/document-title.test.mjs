import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("phone WebView document title", () => {
  it("lets the Even native bar own the single project title", () => {
    expect(html).toContain("<title>Even Realities</title>");
    expect(html).not.toContain("Even Realities HUD Prototype");
  });
});

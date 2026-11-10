import { describe, expect, it } from "vitest";
import { aiReadinessError } from "./ai-readiness-i18n";
import { translateConversate } from "./conversate-i18n";
import { getReleaseCopy } from "./release-i18n";

describe("release localization", () => {
  it("localizes first-use guidance and Conversate outside English and Korean", () => {
    expect(getReleaseCopy("ja", "openAiSetupTitle")).not.toBe(getReleaseCopy("en", "openAiSetupTitle"));
    expect(translateConversate("fr", "keyRequired")).not.toBe(translateConversate("en", "keyRequired"));
  });
  it("shows safe localized guidance instead of raw provider diagnostics", () => {
    expect(aiReadinessError("Unauthorized API key sk-private-value", "ko")).toBe(getReleaseCopy("ko", "errorKey"));
    expect(aiReadinessError("AI response timed out", "ja")).toBe(getReleaseCopy("ja", "errorTimeout"));
    expect(aiReadinessError("unknown diagnostic with private text", "ko")).toBe(getReleaseCopy("ko", "errorGeneric"));
  });
});

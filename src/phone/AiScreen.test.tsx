// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiHudSnapshot } from "../ai-hud-state";
import type { EvenStorage } from "../live-cache";
import { translatePhone } from "../phone-i18n";
import { AiScreen } from "./AiScreen";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

afterEach(cleanup);

describe("AiScreen", () => {
  it("links directly to the official OpenAI API key page", () => {
    render(
      <AiScreen
        snapshot={createAiHudSnapshot(false)}
        t={(name) => translatePhone("en", name)}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Get an OpenAI API key ↗" }).getAttribute("href"),
    ).toBe("https://platform.openai.com/api-keys");
  });

  it("stores a validated BYOK key locally and only renders its masked form", async () => {
    const storage = new TestStorage();
    const onKeyChange = vi.fn();
    const key = "sk-test-1234567890abcdefghijklmnop";
    const view = render(
      <AiScreen
        storage={storage}
        snapshot={createAiHudSnapshot(false)}
        t={(name) => translatePhone("en", name)}
        onKeyChange={onKeyChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("OpenAI API key"), {
      target: { value: key },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onKeyChange).toHaveBeenCalledWith(key));
    expect(storage.values.get("sandevistan:openai-key:v1")).toContain(key);

    view.rerender(
      <AiScreen
        storage={storage}
        openAiKey={key}
        snapshot={createAiHudSnapshot(true)}
        t={(name) => translatePhone("en", name)}
      />,
    );
    expect(screen.queryByDisplayValue(key)).toBeNull();
    expect(screen.queryByText(key)).toBeNull();
    expect(screen.getByText("sk-t••••mnop")).toBeTruthy();
  });

  it("shows this device's week and month estimates plus three excerpts", () => {
    const history = ["one", "two", "three"].map((id, index) => ({
      id,
      endedAt: `2026-08-0${index + 1}T12:00:00.000Z`,
      user: `Question ${index + 1}`,
      assistant: `Answer ${index + 1}`,
    }));
    render(
      <AiScreen
        snapshot={createAiHudSnapshot(true, history, 0.0042, 0.018)}
        t={(name) => translatePhone("en", name)}
      />,
    );

    expect(screen.getByText("$0.0042")).toBeTruthy();
    expect(screen.getByText("$0.02")).toBeTruthy();
    expect(screen.getAllByText(/Question [1-3]/)).toHaveLength(3);
    expect(screen.getAllByText(/Answer [1-3]/)).toHaveLength(3);
  });

  it("changes the live response interval and warns about unpriced usage", () => {
    const onTextIntervalChange = vi.fn();
    render(
      <AiScreen
        snapshot={{
          ...createAiHudSnapshot(true, [], 0.01, 0.03),
          hasUnpricedUsage: true,
        }}
        textIntervalMs={200}
        t={(name) => translatePhone("en", name)}
        onTextIntervalChange={onTextIntervalChange}
      />,
    );

    const slider = screen.getByLabelText("Response display speed");
    expect(slider.getAttribute("min")).toBe("100");
    expect(slider.getAttribute("max")).toBe("1000");
    expect(slider.getAttribute("step")).toBe("50");
    fireEvent.change(slider, { target: { value: "350" } });
    expect(onTextIntervalChange).toHaveBeenCalledWith(350);
    expect(screen.getByText("350 ms per character")).toBeTruthy();
    expect(screen.getByText("Some usage could not be priced.")).toBeTruthy();
  });

  it("adds an HTTPS MCP server locally with per-call glasses approval", async () => {
    const storage = new TestStorage();
    render(
      <AiScreen
        storage={storage}
        snapshot={createAiHudSnapshot(true)}
        t={(name) => translatePhone("en", name)}
      />,
    );
    fireEvent.change(screen.getByLabelText("Server name"), {
      target: { value: "Docs MCP" },
    });
    fireEvent.change(screen.getByLabelText("HTTPS server URL"), {
      target: { value: "https://mcp.example.com/sse" },
    });
    fireEvent.change(screen.getByLabelText("Bearer token (optional)"), {
      target: { value: "Bearer private-token" },
    });
    fireEvent.change(screen.getByLabelText("Allowed tools (comma-separated)"), {
      target: { value: "search, read_doc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => expect(screen.getByText("Docs MCP")).toBeTruthy());
    const raw = storage.values.get("sandevistan:mcp-servers:v1") ?? "";
    expect(raw).toContain("https://mcp.example.com/sse");
    expect(raw).toContain("private-token");
    expect(raw).not.toContain("Bearer private-token");
    expect(screen.queryByText("private-token")).toBeNull();
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translatePhone } from "../phone-i18n";
import { DEFAULT_PHONE_PREFERENCES } from "../phone-preferences";
import { HudLayoutScreen } from "./HudLayoutScreen";

afterEach(cleanup);

describe("HudLayoutScreen", () => {
  it("lets the user keep the dashboard's left map area empty", async () => {
    const onChange = vi.fn(async () => true);
    render(
      <HudLayoutScreen
        preferences={DEFAULT_PHONE_PREFERENCES}
        navigationAvailable={false}
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Map on dashboard.*Enabled/ }));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_PHONE_PREFERENCES,
      dashboardMapEnabled: false,
    }));
  });

  it("shows a pixel checkbox for every page enablement state", () => {
    const onChange = vi.fn(async () => true);
    const { rerender } = render(
      <HudLayoutScreen
        preferences={DEFAULT_PHONE_PREFERENCES}
        navigationAvailable={false}
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("button", {
      name: /Overview.*Always on/,
    }).querySelector('[data-phone-icon="checkboxOn"]')).toBeTruthy();
    expect(screen.getByRole("button", {
      name: /Weather.*Enabled/,
    }).querySelector('[data-phone-icon="checkboxOn"]')).toBeTruthy();

    rerender(
      <HudLayoutScreen
        preferences={{
          ...DEFAULT_PHONE_PREFERENCES,
          enabled: ["overview", "news", "todo"],
        }}
        navigationAvailable={false}
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("button", {
      name: /Weather.*Disabled/,
    }).querySelector('[data-phone-icon="checkbox"]')).toBeTruthy();
  });

  it("locks Overview, hides unavailable Navigation, and persists edits", async () => {
    const onChange = vi.fn(async () => true);
    render(
      <HudLayoutScreen
        preferences={DEFAULT_PHONE_PREFERENCES}
        navigationAvailable={false}
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("button", { name: /Overview.*Always on/ })
      .hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Navigation")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Weather.*Enabled/ }));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_PHONE_PREFERENCES,
      enabled: ["overview", "news", "x", "todo", "ai", "conversate"],
    }));
  });

  it("reorders enabled pages and reports a rejected atomic save", async () => {
    const onChange = vi.fn(async () => false);
    render(
      <HudLayoutScreen
        preferences={DEFAULT_PHONE_PREFERENCES}
        navigationAvailable={false}
        t={(key) => translatePhone("en", key)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move up TODO" }));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_PHONE_PREFERENCES,
      order: ["overview", "news", "todo", "x", "weather", "ai", "conversate"],
    }));
    expect(await screen.findByText("Could not save on this device."))
      .toBeTruthy();
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { translatePhone } from "../phone-i18n";
import { ByokScreen } from "./ByokScreen";

afterEach(cleanup);

describe("ByokScreen", () => {
  it("explains that weather and map data do not need a key", () => {
    render(<ByokScreen t={(key) => translatePhone("en", key)} />);

    expect(screen.getByText(
      "Weather and map use cached public data. No API key is required.",
    )).toBeTruthy();
  });

  it("uses the X-only relay by default and keeps its custom URL behind a separate action", () => {
    render(<ByokScreen t={(key) => translatePhone("en", key)} />);

    expect(screen.getByText("Default X-only relay")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Customize relay" })).toBeTruthy();
    expect(screen.queryByText("Custom X Relay URL")).toBeNull();
  });
});

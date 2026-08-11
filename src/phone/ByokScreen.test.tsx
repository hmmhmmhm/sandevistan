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
});

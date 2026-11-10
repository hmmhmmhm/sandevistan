// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhoneIcon } from "./phone-icons";

afterEach(cleanup);

describe("PhoneIcon", () => {
  it("maps semantic checkbox names to the visibly correct pixel icons", () => {
    const { rerender } = render(<PhoneIcon name="checkboxOn" />);
    const checkedPath = screen.getByRole("img", { hidden: true })
      .querySelector("path")?.getAttribute("d") ?? "";

    expect(checkedPath).toContain("M7 12h2v2H7");

    rerender(<PhoneIcon name="checkbox" />);
    const emptyPath = screen.getByRole("img", { hidden: true })
      .querySelector("path")?.getAttribute("d") ?? "";

    expect(emptyPath).not.toContain("M7 12h2v2H7");
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePhoneTheme } from "./use-phone-theme";
import { PhoneThemeControl } from "./PhoneThemeControl";
import type { EvenStorage } from "../live-cache";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Harness({ storage }: { storage: EvenStorage }) {
  const theme = usePhoneTheme(storage);
  return <><output>{theme.resolved}</output><PhoneThemeControl locale="en" value={theme.setting} onChange={theme.choose}/>{theme.error && <p role="alert">Save failed</p>}</>;
}
it("follows system changes, persists explicit selection, and keeps the override", async () => {
  let dark = true, change: (() => void) | undefined;
  vi.stubGlobal("matchMedia", () => ({ get matches() { return dark; }, addEventListener: (_: string, listener: () => void) => { change = listener; }, removeEventListener: vi.fn() }));
  let saved = '"system"';
  const storage = { getLocalStorage: async () => saved, setLocalStorage: vi.fn(async (_key: string, value: string) => { saved = value; return true; }) };
  const first = render(<Harness storage={storage}/>);
  await waitFor(() => expect(screen.getByRole("radio", { name: "Auto", checked: true })).toBeTruthy());
  expect(screen.getByRole("status").textContent).toBe("dark");
  act(() => { dark = false; change?.(); });
  expect(screen.getByRole("status").textContent).toBe("light");
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  await waitFor(() => expect(saved).toBe('"dark"'));
  act(() => { dark = true; change?.(); dark = false; change?.(); });
  expect(screen.getByRole("status").textContent).toBe("dark");
  first.unmount(); expect(document.documentElement.hasAttribute("data-phone-theme")).toBe(false);
  render(<Harness storage={storage}/>);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("dark"));
  await waitFor(() => expect(screen.getByRole("radio", { name: "Dark", checked: true })).toBeTruthy());
});
it("ignores a late stored choice after the user selects a theme and reports failed saves", async () => {
  let finish: (value: string) => void = () => {};
  const storage = { getLocalStorage: () => new Promise<string>(resolve => { finish = resolve; }), setLocalStorage: async () => false };
  render(<Harness storage={storage}/>);
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  await act(async () => finish('"light"'));
  expect(screen.getByRole("status").textContent).toBe("dark");
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Save failed"));
});

it("carries an explicit selection into Even storage when the bridge replaces browser storage", async () => {
  const initial = { getLocalStorage: async () => "", setLocalStorage: async () => true };
  const next = { getLocalStorage: async () => '\"light\"', setLocalStorage: vi.fn(async () => true) };
  const { rerender } = render(<Harness storage={initial}/>);
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  rerender(<Harness storage={next}/>);
  await waitFor(() => expect(next.setLocalStorage).toHaveBeenCalledWith("sandevistan:phone-theme:v1", '\"dark\"'));
  expect(screen.getByRole("status").textContent).toBe("dark");
});

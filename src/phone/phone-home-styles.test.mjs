import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./phone-home.css", import.meta.url), "utf8");
const shellCss = readFileSync(
  new URL("./phone-shell.css", import.meta.url),
  "utf8",
);
const detailCss = readFileSync(
  new URL("./phone-detail.css", import.meta.url),
  "utf8",
);

describe("Even-style phone HUD preview", () => {
  it("neutralizes the global green HUD overlay inside the phone preview", () => {
    expect(css).toContain(
      ".phone-home__preview-slot .hud-frame::after",
    );
    expect(css).toMatch(
      /\.phone-home__preview-slot \.hud-frame::after\s*\{[^}]*display:\s*none/s,
    );
  });

  it("uses a neutral low-contrast treatment without color blending", () => {
    expect(css).toMatch(
      /\.phone-home__preview-slot \.hud-frame canvas\s*\{[^}]*filter:\s*grayscale\(1\) invert\(1\) contrast\(0\.62\)/s,
    );
    expect(css).toMatch(
      /\.phone-home__preview-slot \.hud-frame canvas\s*\{[^}]*mix-blend-mode:\s*normal/s,
    );
  });

  it("raises contrast only while the glasses display is active", () => {
    expect(css).toMatch(
      /\.phone-home__preview\[data-active="true"\][\s\S]*?contrast\(0\.84\)[\s\S]*?opacity:\s*0\.46/s,
    );
  });
});

describe("Even-style phone card geometry", () => {
  it("uses the approved neutral palette and two-column proportions", () => {
    expect(shellCss).toMatch(/--phone-bg:\s*#eeeeee/);
    expect(shellCss).toMatch(/--phone-card:\s*#ffffff/);
    expect(shellCss).toMatch(/--phone-preview:\s*#e0e0e0/);
    expect(css).toMatch(
      /\.phone-home__grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*8px/s,
    );
    expect(css).toMatch(
      /\.phone-home-card\s*\{[^}]*aspect-ratio:\s*1\.28\s*\/\s*1[^}]*border-radius:\s*8px[^}]*box-shadow:\s*none/s,
    );
  });

  it("preserves two columns at the 320-pixel acceptance width", () => {
    const narrowRule = css.match(/@media\s*\(max-width:\s*350px\)\s*\{([\s\S]*)\}\s*$/)?.[1]
      ?? "";
    expect(narrowRule).toContain(".phone-home-card");
    expect(narrowRule).not.toContain("grid-template-columns");
  });
});

describe("phone interaction targets", () => {
  it("keeps compact reorder and TODO controls at least 44 pixels wide", () => {
    expect(detailCss).toMatch(
      /\.phone-reorder-actions button\s*\{[^}]*width:\s*44px[^}]*height:\s*46px/s,
    );
    expect(detailCss).toMatch(
      /\.phone-check-button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s,
    );
    expect(detailCss).toMatch(
      /\.phone-item-row\s*\{[^}]*grid-template-columns:\s*44px\s+minmax\(0,\s*1fr\)\s+44px\s+44px/s,
    );
    expect(detailCss).toMatch(
      /\.phone-companion \.route-controls input,[\s\S]*?\.phone-companion \.diagnostic-console button\s*\{[^}]*min-height:\s*44px/s,
    );
  });
});

describe("subordinate phone headers", () => {
  it("starts Home at the preview without a redundant project eyebrow", () => {
    expect(css).not.toContain(".phone-home__subheader");
  });

  it("uses a compact text breadcrumb without a second arrow", () => {
    expect(shellCss).toMatch(
      /\.phone-detail-header\s*\{[^}]*min-height:\s*52px/s,
    );
    expect(shellCss).toMatch(
      /\.phone-detail-header\s*\{[^}]*background:\s*transparent/s,
    );
    expect(shellCss).toMatch(
      /\.phone-detail-header__breadcrumb\s*\{[^}]*width:\s*100%[^}]*min-height:\s*44px[^}]*text-align:\s*left[^}]*background:\s*transparent/s,
    );
    expect(shellCss).not.toMatch(
      /\.phone-detail-header\s*\{[^}]*backdrop-filter:/s,
    );
  });
});

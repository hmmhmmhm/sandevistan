# Unified Locale, Map Labels, and RSS Defaults

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

**Date:** 2026-07-29

## Goal

Use the selected phone language for Sandevistan's phone companion, live `/hud-canvas-fast` glasses HUD, weather text, and OSM labels.
Seed three verified RSS sources for Korean and three for English.
Preserve user-added feeds and the existing no-queue image transport behavior.

## Approved behavior

- The phone detail breadcrumb reads `Dashboard / Detail` with both segments at
  the same readable size. The parent is muted and the current detail is bold.
- `System`, `Korean`, and `English` select one effective locale for both the
  phone and the live fast HUD.
- Fixed application copy is localized at render time. RSS article text, OSM
  names without a localized tag, route destinations, and user TODO titles stay
  in their source language.
- The three untouched built-in sample TODO titles follow the selected locale.
  A renamed or newly added user task is never translated.
- Weather descriptions are derived from the stored WMO weather code in the
  active locale. A cached Korean description never leaks into English UI.
- Map payloads retain `name`, `name:ko`, and `name:en` where available. The
  renderer selects the matching name locally and falls back to the OSM default
  name, so a language change does not require another Overpass request.
- The default RSS bundle contains three sources for each supported language.
  Custom sources remain available across language changes.
- Built-in feeds do not consume the six custom-feed slots.
- Changing language requests one best-effort visible HUD redraw. If image
  transport is busy, the redraw is dropped; it is never queued or replayed.
- Legacy diagnostic and experimental Canvas routes retain their recorded copy
  and transport evidence. This localization change applies to the shipped phone
  companion and `/hud-canvas-fast`.

## Locale architecture

`App` resolves the effective locale once from the persisted setting and browser
language. It passes the result to the phone companion and exposes it to the fast
HUD controller through the existing mutable preferences reference.

Fast HUD drawing functions accept a locale parameter and obtain all fixed copy
from a small `hud-i18n` module. Keeping strings outside the already-large Canvas
modules avoids further expanding files that exceed the repository's 450-line
boundary.

The controller resolves the locale immediately before every draw. A locale
change invokes a best-effort redraw callback owned by the controller. The
callback uses the existing refresh busy guard and therefore cannot create a
pending refresh queue or rebuild the SDK session.

## Map architecture

The map Worker returns an optional `localizedNames` object on each road and
place label:

```ts
{
  name: "\uB300\uCCB4\uB85C",
  localizedNames: {
    ko: "\uB300\uCCB4\uB85C",
    en: "Daeche-ro"
  }
}
```

Only bounded, sanitized strings are accepted. The phone weather screen and both
map renderers use a shared `mapLabelName(label, locale)` helper. Server and
client cache versions are bumped so old Korean-only payloads cannot remain
valid for 24 hours.

## RSS architecture

Built-in sources carry a `locale` field and stable IDs. The source resolver
merges the active locale's three built-ins with persisted custom sources.
Built-in enable/disable preferences are stored with the source list and survive
reloads. Custom sources stay locale-neutral and are included for either locale.

Initial verified bundles:

| Locale | Source | Feed |
| --- | --- | --- |
| Korean | SBS Latest | `https://news.sbs.co.kr/news/newsflashRssFeed.do?plink=RSSREADER` |
| Korean | Newsis Breaking | `https://www.newsis.com/RSS/sokbo.xml` |
| Korean | Weekly Kyunghyang | `https://weekly.khan.co.kr/rss/rssdata/total_news.xml` |
| English | BBC World | `https://feeds.bbci.co.uk/news/world/rss.xml` |
| English | The Guardian World | `https://www.theguardian.com/world/rss` |
| English | Le Monde International | `https://www.lemonde.fr/en/international/rss_full.xml` |

All six endpoints returned a valid RSS document and supported content type on
2026-07-29. Existing one-hour refill, 100-item cap, progressive merge, and
"do not refill while reading" behavior remain unchanged.

## Migration

The current source schema assumes exactly one immutable default. The new reader
accepts the legacy `sbs-latest` record, upgrades it to the three-source Korean
built-in bundle, and preserves every valid custom record. New source metadata is
optional when reading old storage but normalized on the next write.

The news cache is not wiped solely for a language switch. The explicit source
change refresh uses the established refill guard; while a user is reading, the
new bundle takes effect at the next permitted refill.

## Verification

- Unit tests cover translations, weather-code labels, map-label selection,
  cache migration, locale-specific RSS bundles, custom-source preservation, and
  HUD draw copy.
- Component tests cover the stronger breadcrumb hierarchy and English phone
  screens without fixed Korean copy.
- Worker tests cover multilingual OSM response parsing and all fixed RSS feed
  aliases.
- Existing transport tests prove tile order, bilateral behavior, and no-queue
  busy-drop semantics remain unchanged.
- Run all checks serially, then build and test the Sites artifact.

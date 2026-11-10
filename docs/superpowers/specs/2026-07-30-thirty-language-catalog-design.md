# Thirty-Language Catalog Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-30

Status: approved for implementation

## Goal

Expand Sandevistan from two to thirty fully bundled interface languages while
preserving the proven G2 transport contract. Every supported language must
ship with exactly three enabled, non-deletable built-in news channels that
return live HTTPS RSS or Atom data without redirects.

## Non-goals

- Do not adopt SDK `0.0.12`.
- Do not change Canvas dimensions, tile IDs, tile order, busy-drop behavior,
  display hiding, or detail-deck gestures.
- Do not translate user-authored TODOs, article content, destination names, or
  route instructions.
- Do not add a runtime translation API, translation key, or network dependency.
- Do not tag a release or submit to Even Hub.

## Language catalog

The registry order is deterministic and becomes the phone language-picker
order. Korean and English retain their existing first and second positions.

| Code | Native label | Browser-language aliases | Direction |
| --- | --- | --- | --- |
| `ko` | existing Korean native label | `ko`, `ko-KR` | LTR |
| `en` | English | `en`, `en-US`, `en-GB` | LTR |
| `ja` | 日本語 | `ja`, `ja-JP` | LTR |
| `zh-Hans` | 简体中文 | `zh-Hans`, `zh-CN`, `zh-SG` | LTR |
| `zh-Hant` | 繁體中文 | `zh-Hant`, `zh-TW`, `zh-HK`, `zh-MO` | LTR |
| `es` | Español | `es`, `es-ES`, `es-419` | LTR |
| `fr` | Français | `fr`, `fr-FR`, `fr-CA` | LTR |
| `de` | Deutsch | `de`, `de-DE`, `de-AT`, `de-CH` | LTR |
| `it` | Italiano | `it`, `it-IT` | LTR |
| `pt` | Português | `pt`, `pt-BR`, `pt-PT` | LTR |
| `nl` | Nederlands | `nl`, `nl-NL`, `nl-BE` | LTR |
| `pl` | Polski | `pl`, `pl-PL` | LTR |
| `ru` | Русский | `ru`, `ru-RU` | LTR |
| `uk` | Українська | `uk`, `uk-UA` | LTR |
| `tr` | Türkçe | `tr`, `tr-TR` | LTR |
| `ar` | العربية | `ar`, `ar-SA`, `ar-AE`, `ar-EG` | RTL |
| `he` | עברית | `he`, `he-IL`, `iw`, `iw-IL` | RTL |
| `hi` | हिन्दी | `hi`, `hi-IN` | LTR |
| `bn` | বাংলা | `bn`, `bn-BD`, `bn-IN` | LTR |
| `id` | Bahasa Indonesia | `id`, `id-ID`, `in`, `in-ID` | LTR |
| `vi` | Tiếng Việt | `vi`, `vi-VN` | LTR |
| `th` | ไทย | `th`, `th-TH` | LTR |
| `ms` | Bahasa Melayu | `ms`, `ms-MY` | LTR |
| `fil` | Filipino | `fil`, `fil-PH`, `tl`, `tl-PH` | LTR |
| `sv` | Svenska | `sv`, `sv-SE` | LTR |
| `no` | Norsk | `no`, `no-NO`, `nb`, `nb-NO`, `nn`, `nn-NO` | LTR |
| `da` | Dansk | `da`, `da-DK` | LTR |
| `fi` | Suomi | `fi`, `fi-FI` | LTR |
| `cs` | Čeština | `cs`, `cs-CZ` | LTR |
| `ro` | Română | `ro`, `ro-RO` | LTR |

## Locale-pack architecture

Each language remains one complete `src/i18n/locales/<code>.ts` module. A pack
contains metadata, every phone string, every shipped fast-HUD string, route
copy, weather conditions, the three built-in TODO labels, and seven weekdays.
Every non-English pack must continue to use `satisfies LocalePack`, so one
missing, extra, or misspelled field fails TypeScript.

Add a required `direction: "ltr" | "rtl"` field to `LocalePack`.
Apply the resolved direction to the phone companion root.
Keep the nested tactical HUD preview geometrically LTR so RTL cannot mirror the map or tile layout.
Unicode bidi shaping still renders Arabic and Hebrew strings in their natural reading order within fixed Canvas regions.

The registry remains the only supported-language declaration. Preference
validation, browser-language matching, the language screen, map localized-name
selection, weather, TODO relabeling, route controls, and HUD rendering continue
to derive from it. No consumer may add a thirty-language switch statement.

## Translation policy

All product-owned copy is bundled and complete. English fallback is not used
for a registered locale. Technical proper nouns such as Sandevistan, G2, R1,
Even Hub SDK, RSS, OSM, and OpenRouteService remain unchanged where that is
clearer than transliteration.

Short HUD copy prioritizes optical readability over literal translation.
Translations must avoid embedded controls, preserve degree and distance
symbols, and keep user-data boundaries unchanged. Native labels are written in
the language's own script.

## News-channel architecture

Every locale has exactly three built-in channels.

- Korean keeps SBS Latest, Newsis Breaking, and Weekly Kyunghyang.
- English keeps BBC World, The Guardian World, and Le Monde International.
- Twenty-six added locales use localized Google News channels for Top Stories,
  World, and Technology.
- Danish uses DR All News, DR Denmark, and DR World because Google News
  redirects Danish requests to Norwegian.
- Filipino uses direct GMA Nation, Philstar Headlines, and Rappler Latest
  feeds because Google News redirects Filipino requests to English.

The Google channel builder stores one canonical `hl`, `gl`, and `ceid` tuple per
locale and creates three explicit final URLs. Chinese uses `zh-Hans` and
`zh-Hant` `ceid` values. Brazilian Portuguese uses `pt-419`. Malay and Finnish
use the canonical `ms-MY` and `fi-FI` `hl` values. These forms were selected
because the live endpoints return `200` directly instead of redirecting.

`server/news-feeds.js` remains the single browser/server catalog. IDs and URLs
are globally unique, and each entry includes a supported locale and a localized
display name.

## Live RSS verification

Unit tests continue to prove catalog structure, supported locale membership,
unique IDs and URLs, HTTPS-only URLs, and exactly three feeds per locale.

A new serial live verifier checks all ninety URLs using the same security
expectations as the Worker:

1. eight-second timeout per request;
2. `redirect: "manual"`;
3. HTTP `200`;
4. XML-compatible content type;
5. response at or below one megabyte;
6. RSS or Atom root;
7. at least one item or entry.

The verifier reports every feed instead of stopping at the first failure and
exits nonzero if any channel fails. It is an explicit release/audit command,
not part of offline `npm test`.

## Error handling

- Unknown persisted locale values still fall back to English through the
  existing preference normalizer.
- Browser locale matching checks exact aliases before language-base fallback.
  This prevents Traditional Chinese from collapsing into Simplified Chinese.
- A failed live RSS audit blocks this implementation from being described as
  complete. No redirect or stale placeholder URL is accepted.
- Runtime feed failures continue to retain the last successful cached news
  library; they do not create a deferred refresh queue.

## Test and acceptance gates

- `SUPPORTED_LOCALES` contains exactly thirty unique codes in approved order.
- Every pack has an identical recursive key shape, seven weekdays, matching
  code metadata, a nonempty native name, browser aliases, and a valid direction.
- Representative aliases resolve correctly, including `zh-TW`, `pt-BR`,
  legacy `iw-IL`, legacy `in-ID`, `tl-PH`, `nb-NO`, and unknown fallback.
- Phone RTL direction changes for Arabic and Hebrew and remains LTR otherwise.
- The shared feed catalog has ninety unique HTTPS entries and exactly three per
  locale.
- All ninety feeds pass the serial live verifier in the implementation audit.
- Existing full Vitest, Node API, Sites, build, package, repository-copy, and
  diff checks pass.
- A browser audit confirms the thirty options render and that representative
  Latin, CJK, Indic, Thai, Arabic, and Hebrew selections update Home and one
  detail screen without fixed-language leakage.
- SDK `0.0.11`, four-tile output, and the physical G2 baseline remain unchanged.

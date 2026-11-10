# Extensible I18n Registry

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

**Date:** 2026-07-30

## Goal

Make each new Sandevistan language an isolated addition.
Require one complete locale pack, one registry entry, and three built-in RSS definitions.
Preserve existing Korean and English behavior for the phone, G2 HUD, map, weather, TODO, routing, storage, and transport.

## Approved scope

- Preserve the current Korean and English rendered copy.
- Preserve the `/hud-canvas-fast` four-tile layout, transfer order, no-queue
  refresh behavior, and SDK `0.0.11` baseline.
- Keep user-authored TODO text, RSS content, route instructions, destination
  names, and OSM fallback names untranslated.
- Centralize application-owned phone, HUD, route, weather-condition, default
  TODO, weekday, locale-label, and browser-language metadata in one locale
  registry.
- Generate the language picker and persisted-locale validation from that
  registry.
- Preserve every bounded OSM `name:<language>` value in map responses so the
  map server does not need a code change when an application locale is added.
- Share one built-in RSS feed catalog between the browser and server instead of
  duplicating aliases and URLs.
- Fail tests when a locale pack is incomplete, its code does not match its
  registry key, it lacks exactly three built-in feeds, or visible domain copy
  bypasses the locale pack.

## Locale-pack architecture

The English locale pack is the structural reference. A recursive mapped type
turns its literal values into string slots while preserving every object key and
the seven-item weekday tuple. Every other locale pack must satisfy that shape.
TypeScript therefore reports missing, misspelled, or extra translation keys at
the locale file where the error was introduced.

```text
src/i18n/
├── locale-schema.ts
├── locale-registry.ts
└── locales/
    ├── en.ts
    └── ko.ts
```

Each locale pack owns:

- `code`, `nativeName`, and accepted browser-language prefixes;
- phone companion copy;
- G2 fast-HUD copy;
- route-control copy, including travel profile labels;
- weather-condition labels;
- the three built-in TODO titles; and
- all seven weekday names.

`PhoneLocale` and `PhoneLocaleSetting` remain compatibility aliases, but derive
from the registry rather than a handwritten union. Existing translation
functions remain small adapters so consumers do not need a disruptive rewrite.

## Resolution and persistence

`SUPPORTED_LOCALES`, locale options, `isSupportedLocale`, and system-language
resolution derive from the registry. Resolution normalizes underscores and
case, checks exact configured tags first, then the base language, and finally
falls back to English.

The persisted preference reader validates against `SUPPORTED_LOCALES`. Unknown
or removed locale values safely normalize to `system`; existing `ko`, `en`, and
`system` records remain valid without a storage migration.

The phone language screen renders `System` followed by registry-generated
native language names. Home status uses the same metadata, eliminating binary
Korean/English conditionals.

## Domain adapters

- `phone-i18n` reads `pack.phone`.
- `hud-i18n` reads `pack.hud` and `pack.weekdays`.
- `weatherCodeLabel` maps WMO codes to semantic condition keys, then reads
  `pack.weather`.
- default TODO localization reads `pack.todos` by stable built-in task ID.
- route controls read `pack.route`; technical route state tokens remain the
  existing intentional HUD-style English tokens.

This keeps domain behavior separate from locale storage while making all
application-owned translated copy part of one completeness contract.

## Map localization

The map server sanitizes bounded `name:<language-tag>` fields generically
instead of selecting only `name:ko` and `name:en`. It accepts normalized OSM
language tags, caps the localized-name count per label, and retains the OSM
default `name` as fallback.

The client validates the same bounded record and selects
`localizedNames[locale] ?? name`. The server and client cache versions advance
once so old two-language payloads cannot mask the new generic contract. Future
locale additions require no map-server change.

## Shared RSS catalog

`server/news-feeds.js` becomes the single runtime catalog for built-in feed ID,
name, URL, and locale. Both `src/rss-sources.ts` and `server/news.js` import it.
The Sites build copies the catalog beside the other server modules.

Runtime tests require:

- unique feed IDs and URLs;
- public HTTPS URLs;
- a supported locale for every feed; and
- exactly three built-in feeds for every supported locale.

Custom feeds remain locale-neutral, retain the existing six-source limit, and
continue through the guarded custom URL proxy.

## Adding a language

Adding Japanese, for example, consists of:

1. Add `src/i18n/locales/ja.ts` satisfying the locale-pack schema.
2. Import and register it once in `locale-registry.ts`.
3. Add three `locale: "ja"` entries to `server/news-feeds.js`.
4. Add translation-quality assertions for the new copy.

These definitions update the language picker, preference validation, system resolution, phone status, and HUD rendering.
They also update weather, TODO, route controls, OSM label selection, RSS filtering, and feed-count validation.

## Failure handling and compatibility

- Unsupported persisted locales normalize to `system`.
- Unsupported browser locales fall back to English.
- Missing localized OSM names fall back to the default OSM name.
- Incomplete locale packs fail type checking.
- Missing or duplicate feed definitions fail tests before packaging.
- Existing caches remain readable where safe; only the map cache is versioned
  because its payload contract changes.
- No locale operation introduces a refresh queue, network retry queue, or
  additional G2 tile transmission.

## Verification

- Registry tests cover derived locale lists, native options, matching, fallback,
  code/key consistency, recursive translation-key completeness, and weekdays.
- Component tests prove language choices are registry-driven.
- Domain tests preserve Korean and English phone, HUD, weather, TODO, and route
  output.
- Map tests cover generic `name:ja` preservation and fallback behavior.
- RSS client/server tests prove one shared catalog and exactly three built-ins
  per supported locale.
- Repository policy, TypeScript, all Vitest files, Node API tests, Sites tests,
  production build, and EHPK packaging run serially.

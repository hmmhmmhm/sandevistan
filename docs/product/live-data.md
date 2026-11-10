# Live data and navigation

Maps, weather, news and tasks do not require an OpenAI key.
Only optional destination lookup and route calculation require an OpenRouteService key.

## Providers and refresh rules

| Data | Provider | Refresh rule |
| --- | --- | --- |
| Location | Even Hub SDK | Normal accepted update interval: `15s / 15m` |
| Weather | Open-Meteo | 15-minute cache and foreground check |
| News | Selected HTTPS RSS publishers through the API Worker | Up to 100 stories. Idle refill interval: one hour |
| Map | OpenStreetMap-derived data | Update when the rounded location cell changes |
| Clock | Device local time | Minute boundary |
| Battery | Even device-state events | Update when the visible value changes |

Packaged maps use OpenFreeMap vector tiles and OpenMapTiles data.
Local and Sites map handlers use Overpass.
The public API origin is in `.env.evenhub`. That file contains a public URL, not a credential.

## Missing and stale data

The app can use a recent cached location when live location is unavailable.
Without a cached location, it labels the demo data.
Missing map data shows `NO DATA`. Missing location shows `NO GPS DATA`.
A location without heading uses a hollow circle instead of a direction arrow.
Weather, news and map failures retain the last successful value with a stale state.

## News sources

Each locale has three built-in feeds. The catalog contains 540 configured entries across 180 locales.
Locales without a stable local edition use the declared English international fallback feeds.
Custom feeds are shared across locales. You can store up to six custom HTTPS sources.

The server validates custom URLs before it requests a feed.
It rejects credentials, fragments, non-default ports, IP literals, private hosts, redirects and non-feed content.
It also rejects responses above 1 MB and requests above eight seconds.
The glasses reader uses sanitized title, summary and publication time. It does not load arbitrary article HTML.

Run `npm run verify:rss-live` after you change built-in feeds.
The command checks feeds sequentially.

## Languages

The app contains 180 offline locale packs. Runtime interface translation does not call a translation service.
The system language selects the first locale when no explicit supported locale is saved.
RTL phone languages set the phone direction. The 576×288 glasses Canvas remains left-to-right.

Do not translate user-authored tasks, article content, destination names or route instructions as interface copy.
The phone displays a machine-translation quality notice.
See [Add a language](../i18n/adding-a-language.md) for the registry and catalog requirements.

## Optional navigation

Enter your own OpenRouteService key in the phone Navigation card.
The app validates the key and stores it through the Even local-storage bridge.
A dedicated request header supplies the key to the fixed routing endpoint.
The server does not intentionally persist or log that key.
`ORS_API_KEY` is a server-only development fallback. Never use a `VITE_` variable for a secret.

Active guidance changes location sampling to `2s / 5m`.
Three consecutive positions at least 35m off the route trigger a recalculation.
Recalculation has a 30-second minimum interval.
Ending guidance restores `15s / 15m` and clears the route.

Recent routes remain local for at most six hours. The app does not resume them automatically.
Without a valid key, navigation controls stay hidden and other data pages remain available.

See [privacy and limitations](../reference/privacy-and-limitations.md) for provider data flow.

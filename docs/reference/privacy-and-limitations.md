# Privacy, attribution and limitations

## Local data and keys

The Even local-storage bridge stores preferences, tasks, cached data, API keys and bounded AI history.
This is not a promise of encrypted local storage.
The app does not bundle or log real API keys.
OpenAI requests go directly to OpenAI. Optional routing keys pass through a fixed routing endpoint without intentional server persistence.

Provider requests disclose the requested data and connection metadata to those providers.
Location can reach weather, map, lookup and routing providers.
Speech, captions, context and AI tool results can reach OpenAI during an active AI session.
RSS publishers receive requests through the proxy.
Custom MCP is disabled in the public package.

Read the [application privacy policy](../../server/privacy-policy.json) for provider and deletion details.
The public API policy is at [the Worker privacy page](https://sandevistan-api.hmmhmmhm.workers.dev/privacy).
Deleting local history does not delete a provider's retained account records.

## Providers and attribution

- Weather: [Open-Meteo](https://open-meteo.com/).
- Place data: [GeoNames](https://www.geonames.org/).
- Map data: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under ODbL.
- Packaged vector maps: [OpenFreeMap](https://openfreemap.org/) and [OpenMapTiles](https://openmaptiles.org/).
- Optional routing: [OpenRouteService](https://openrouteservice.org/).
- AI: the user's OpenAI API account.
- News: enabled built-in or user-selected RSS publishers.

Provider permissions, attribution and usage terms still apply to a public build.
Public distribution does not establish a commercial API entitlement.
The per-IP Worker limit is approximate and local to a Cloudflare edge location.
It does not cap aggregate account spend. See [API operations](../maintenance/2026-11-09-public-api-operations.md).

## Verification limits

- SDK `0.0.11` has historical physical transport evidence.
- The current SDK `0.0.16` still needs physical regression checks.
- A simulator acknowledgement does not prove bilateral optical output.
- Synthetic TTS does not prove physical microphone quality.
- Hide does not put the device into a system sleep mode.
- Local AI cost estimates are not provider billing records.
- The app contains machine-translated copy. Mechanical coverage is not native-speaker certification.

Local evidence paths under `output/` are not part of the public Git tree.
They can include private audio, session records or captures.
Do not upload those files to satisfy a documentation link check.
Dated records keep their original scope and can describe superseded behavior.

## License and trademarks

The source uses the [MIT License](../../LICENSE).
Sandevistan is an unofficial fan project.
It has no affiliation with or endorsement from CD PROJEKT RED, the Cyberpunk franchise or Even Realities.
Their owners retain their names and trademarks.
The repository includes no extracted game UI, game logo or proprietary game asset.

# SANDEVISTAN Privacy and Data

Draft for owner approval. Target URL: https://sandevistan-api.hmmhmmhm.workers.dev/privacy. This policy has not been deployed.

Updated: 2026-11-09

## About this app

SANDEVISTAN is an independent glasses dashboard maintained by arasaka at https://github.com/hmmhmmhm/sandevistan. This policy covers the app and its API service at sandevistan-api.hmmhmmhm.workers.dev.

## Location and network permission

With permission, the Even app supplies your location to display maps and weather. Coordinates and place queries may be sent to the SANDEVISTAN Cloudflare Worker and the relevant map, weather, lookup or routing provider. Weather and city lookup use api.open-meteo.com and geocoding-api.open-meteo.com (including GeoNames data). Maps use tiles.openfreemap.org and OpenStreetMap/OpenMapTiles data. Optional place search and routing use api.openrouteservice.org. News requests fetch the built-in or user-selected HTTPS RSS publishers through the Worker.

## Microphone and AI

AI is optional and requires your own paid OpenAI API account. Speech, transcripts, conversation context and tool results used by AI are sent directly to api.openai.com using your key. Ask AI captures speech while its control is held. Conversate listens while its session is active. Leaving the conversation screen stops microphone ownership. Translation, transcription, refinement, hints and answers may use multiple models. Usage is charged to your provider account; local estimates may omit some transcription usage.

Location or weather details requested through AI tools can also be sent to OpenAI as part of the tool result.

## Keys, preferences and history

API keys, preferences, tasks and saved conversation or cue history use local storage supplied by the Even app. Optional OpenRouteService keys are forwarded through the fixed routing service for validation or routing, without intentional server persistence or key logging. This is not a promise of encrypted local storage. No app account or advertising profile is created by SANDEVISTAN.

## Custom external tools

Custom MCP connections are disabled in the publicly packaged Even Hub build because arbitrary server origins are not whitelisted. Existing local server settings are not used by that build. Developer builds may enable explicitly configured tools, whose operators have their own privacy policies.

## Service operations

Cloudflare processes connection metadata to operate and protect the API, including per-IP request limiting. Custom operational events contain only the fixed endpoint path, HTTP status and a count. These custom events do not intentionally contain query strings, coordinates, speech, request bodies, keys or IP addresses. Cloudflare and upstream providers may process network metadata under their own terms. SANDEVISTAN does not implement advertising or sale of personal data.

## Choices and deletion

You may leave AI, routing and external tools unconfigured. Basic maps, weather, news and tasks do not need an OpenAI key. Delete keys and saved AI conversations using the phone companion settings. Deleting local data does not delete records retained by OpenAI, Cloudflare, routing services, publishers or an MCP operator; consult those providers for retention and account deletion controls.

## Contact

For support or privacy questions, email hmmhmhmmhmhmm@gmail.com or open an issue at https://github.com/hmmhmmhm/sandevistan/issues. Never post API keys, private transcripts or precise location in public issue reports.

# Product guide

Sandevistan displays a personal dashboard on Even Realities G2 glasses.
The R1 ring and the glasses temple use the same gestures.
The phone companion supplies settings and a preview at `/hud-canvas-fast`.

## Phone settings

The phone keeps the HUD preview active when you open a settings screen.
A settings screen does not restart the image transport.
Select Auto, Light or Dark for the phone theme. The glasses Canvas does not change theme.

| Card | Function |
| --- | --- |
| Devices | Shows received G2 and R1 battery, charging and connection information |
| HUD layout | Enables and orders pages. Overview stays first |
| News | Selects built-in feeds and manages up to six custom HTTPS feeds |
| TODO | Stores up to six tasks and changes their completion state |
| Weather | Shows conditions and offers a manual refresh |
| Navigation | Validates and stores an optional OpenRouteService key |
| Language | Follows the system language or selects a bundled language |
| Ask AI | Manages the OpenAI key, conversation history and usage estimates |
| Conversate | Configures captions, translation, Inform, Copilot and Prep Note |
| Developer | Shows the local WebView trace |

Unknown device telemetry shows unavailable information. The app does not substitute zero or another device's battery value.

## Glasses pages

The dashboard has a 288×288 map on the left. The right side shows the selected page.

| Page | Dashboard information | Single-tap result |
| --- | --- | --- |
| Overview | Time, date, weather and device battery | Full-screen map |
| News | Headlines from enabled sources | Article detail |
| TODO | Task preview and daily progress | Selectable task list |
| Weather | Current conditions | Weather detail |
| Ask AI | Recent conversations and local cost estimates | New Ask AI session |
| Conversate | Conversation mode | New Conversate session |
| Navigation | Active route and next maneuver | Maneuver detail |

Navigation appears only when an eligible route is active.
The phone can disable or reorder optional pages.

## Dashboard gestures

- Scroll to select another dashboard page.
- Tap once to open the selected page.
- Double tap to open the root quick menu.

The quick menu contains Hide, Exit and Return. Return is selected initially.
Hide replaces the image page with a blank event-capture page.
Exit calls the system confirmation through `shutDownPageContainer(1)`.
Return closes the menu. Hide does not put the glasses into a system sleep mode.

## Detail gestures

Double tap to return to the originating dashboard page.
Each detail view uses scroll for its own content.

| Detail | Scroll | Single tap |
| --- | --- | --- |
| Map | Changes zoom | No action |
| News | Reads article pages, then changes the article | No action |
| TODO | Selects a task | Changes the selected task's completion state |
| Navigation | Selects a maneuver | Returns to the current maneuver |
| Ask AI | Reads earlier or later answer lines | Returns to the latest line and interrupts active generation |
| Conversate | Reads earlier caption lines or selects a cue in the directory | Opens or selects cue history |

Map scroll down zooms out. Scroll up zooms in.
The app retains the selected radius across location and page updates.
The radii are `850m`, `650m`, `500m`, `375m` and `280m`.

See the [AI guide](ai.md) for hold, release and conversation gestures.
See [HUD transport](../architecture/hud-transport.md) for the display contract.

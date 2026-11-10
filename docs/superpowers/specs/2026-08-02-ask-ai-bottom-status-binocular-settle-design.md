# Ask AI Bottom Status and Binocular Restore Settle Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-08-02

Status: Approved

## Goal

Keep transient Ask AI activity text at the bottom of the native transcript.
After Ask AI exit, prevent the lower-right HUD tile from appearing in only one lens.

## Native status placement

The rolling transcript remains the first visible content. Thinking and active
tool labels, including Web search, use the same trailing status slot as the
existing Listening label. Insert one blank display row before that status when
the transcript is non-empty. Do not restore the hidden Displaying label or
change the standalone MCP approval prompt.

The formatter reserves two rows for a trailing status before selecting visible
transcript lines. This keeps the status visible without moving it to the top or
letting it become a transcript scroll target.

## Binocular restore barrier

The accepted AI exit path remains:

1. stop the Realtime session and microphone;
2. rebuild the proven blank event page to neutralize native Text updates;
3. wait 1 s for both lenses to install that neutral page;
4. rebuild the established five-container Canvas page;
5. wait 200 ms for both lenses to install the Canvas containers;
6. invalidate the successful-image cache and send IDs 3, 5, 2, and 4 through
   the existing four-call pipeline.

Apply the wait only to native Ask AI restoration.
Keep existing timing and concurrency for startup, paging, normal external refresh, and blank-display hide or restore.
The SDK has no page-ready event.
Physical testing showed that the inter-rebuild wait improves restoration but does not eliminate intermittent partial display.
Add a second bounded wait between image-page rebuild and image update.

Drop late native Text updates throughout neutralization, rebuild, settling, and image sending.
If either the neutral-page or image-page rebuild fails, send no image data.
Do not retry automatically.
Keep the controller active so a later independent exit input can try again.

## Diagnostics and verification

Add diagnostics after each page-installation boundary:

```text
[REFRESH] native AI neutral page ready · 1000ms
[REFRESH] native AI image page ready · 200ms
```

Test Thinking and Web search formatting below the transcript.
Test that settle callbacks occur between the two rebuilds and before the first image update after image-page rebuild.
Test that waiting drops Text updates.
Before deployment to the existing port 4179 hardware preview, run the complete test, type, repository, Sites, build, and package checks.

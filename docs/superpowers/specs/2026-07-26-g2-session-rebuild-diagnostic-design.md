# G2 session reconfiguration diagnostic design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Background

The `200×100` configuration succeeded in the official image example.
After reapplying it here, `createStartUpPageContainer()` continued to return `invalid`.
PNG format, image size, and container count alone therefore cannot explain the symptom.

According to the Even Hub SDK documentation, create the startup page only once per Glasses UI session.
For later page changes, use `rebuildPageContainer()`.
The user also saw the error after fully closing the app, so an existing session is not yet a confirmed cause.
Record both creation and rebuild results.

## Target

- Distinguish whether page creation failure is due to an existing session or the page definition itself.
- Always display the app version and diagnostic build name in the web view.
- Send the reference image only when the page is ready.
- The existing URL profile for size comparison is maintained.

Sandevistan sensor functions, the full-screen HUD, and STT are outside this diagnostic scope.

## Selected access

Use conditional reconstruction.

1. Once the bridge is ready, try creating a start page with the selected profile.
2. If the creation result is `success`, move to the image transmission step.
3. If the creation result is `invalid`, reorganization is attempted once with the same page definition.
4. If reconstruction is successful, move to the image transmission step.
5. If reconstruction fails, it displays an error and does not start image transfer.
6. Do not attempt reconstruction on `oversize` or `outOfMemory`.

Rebuild only after `invalid`, because either a duplicate session or an incorrect page definition can produce that result.
Compare the rebuild result to distinguish these cases.

The always-reconfiguring method does not guarantee first execution. After force quitting again
Do not use the creation method because it can terminate the web view and the app itself.

## Show webview

Fixed display of the next version string below the title.

`v0.1.0 · session-rebuild-1`

The status area contains information that identifies the next boundary rather than just overwriting the last step.
Display phrases in order.

- `BRIDGE WAIT`
- `BRIDGE READY`
- `PAGE CREATING`
- `PAGE RESULT: <result>`
- `PAGE REBUILDING`
- `PAGE REBUILD RESULT: true|false`
- `PAGE READY <width>x<height> - SEND IN 3S`

If an error occurs, keep the last successful boundary and failure cause readable in the WebView.

## Data flow

Select a diagnostic profile from the WebView URL.
Pass its image-container definition to the page-initialization function.
Return the bridge only after page creation or rebuilding succeeds.
The caller loads the image, waits 3 seconds, and transmits it once serially.

The current baseline profile consists of two text containers and `200×100` like the official example.
Uses one image container.

## Error handling

| Generated Results | Reconstruction | image transfer |
|---|---|---|
| `success` | do not call | progress |
| `invalid` | call once | Proceed only when reconfiguration is successful |
| `oversize` | do not call | interruption |
| `outOfMemory` | do not call | interruption |

If a bridge call throws, stop immediately at that boundary.
Display the exception message in the WebView.

## Test

- When creation is successful, reconfiguration is not called.
- If the creation result is `invalid` and reconfiguration is successful, initialization is completed.
- If the creation result is `invalid` and reconstruction fails, a clear error is returned.
- Do not call reconstruction for `oversize` and `outOfMemory`.
- The status text for each boundary is recorded in the correct order.
- The app version and diagnostic build name are displayed together in the web view.

## Success Criteria

- Automatic tests and TypeScript builds pass.
- The new URL returns HTTP `200` at the Tailscale address.
- In actual G2 execution, the creation results and reconstruction results can be distinguished in the web view.
- Image transmission begins 3 seconds later only if page creation or reconstruction is successful.

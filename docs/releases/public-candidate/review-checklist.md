# Public release review packet

Status: v0.2.7 was rejected on November 10 for missing bundled URL origins in the network whitelist. The v0.2.8 correction and mandatory automated release gate are being prepared. Use [the mandatory checklist](../pre-deployment-checklist.md) for every upload. API deployment is complete; physical-device checks remain pending.

## Owner decisions

- X/Twitter is excluded by the owner.
- The owner approved the key-setup and root quick-menu designs.
- Icon direction 2 is approved; the submission raster follows the portal pixel rules.
- Review actual candidate screenshots and final listing/privacy/release text.

## Release gates

- Translate every shipped UI message, preserve placeholders, remove malformed
  translation delimiters, and document any intentionally retained product names.
- Root exit must call the official system exit API; detail Back must stay intact.
- Missing-key screens must direct users to the phone companion and the relevant
  provider key page without displaying any credential.
- Verify production builds, package contents, tests, and source/artifact hashes.
- Verify installed candidate on physical G2: lock phone for five minutes, reopen,
  repeat AI requests, interrupt an answer, reconnect network, cancel and confirm
  exit, confirm phone WebView closes, then launch a first-party app.
- Deploy and verify API controls only after deployment authorization.
- Obtain explicit approval of final external listing and release copy.

Simulator results cannot replace the physical-device gates. Design fixtures are
preview proposals and must not be presented as screenshots of implemented UI.

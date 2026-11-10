# Even Hub contact address visibility review

Initial investigation: no address had been provided or submitted; no inquiry was sent.

Later owner instruction: the owner supplied a postal address and explicitly requested
entry. The address was saved in the Even Hub contact/privacy form and verified
by reopening it. The release record stores only match results, not the full
postal address. Actual public PDF/mobile address visibility remains unverified.

## Confirmed

The current official portal bundle requires telephone/address and includes them
in each app's privacy data. The form loads from appData.privacy and submits the
serialized privacy object to the app editor. The editor also exposes a generated
privacy/terms PDF link. This is not evidence of account-only storage.

Only the email has an explicit visibility notice in the input form. The public
web catalogue detail implementation examined does not render address or telephone.
Neither observation proves what the native mobile app or generated PDF displays.

Section 3.1 of the Developer Platform Terms permits display of developer names
and contact details. It does not specify that this address is internal-only.
The Developer Privacy Policy's assurance that ERDN applications/Pitches are not
made public concerns a different submission flow and does not establish privacy
for this app-publication contact field.

## Not established

Whether the generated public privacy PDF prints the address or telephone;
whether mobile app details expose them; whether an individual developer may
omit street detail or use a business mailing address. Do not describe either
public or private handling as confirmed.

## Sources

- https://support.evenrealities.com/hc/en-us/articles/15606676690703-Even-Hub-Developer-Platform-Terms-of-Service
- https://support.evenrealities.com/hc/en-us/articles/17472927222031-Even-Hub-Developer-Privacy-Policy
- https://hub.evenrealities.com/_nuxt/BFrrB8BR.js
- https://hub.evenrealities.com/_nuxt/DYzWq3N-.js
- Evidence: output/public-release-prep-2026-11-09/work/address-visibility-evidence.json

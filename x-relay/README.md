# X-only Cloudflare Worker relay

This Worker is the browser-safe relay used by Sandevistan's X card. It accepts
only `GET /2/users/me` and `GET /2/users/:id/timelines/reverse_chronological`.
It does not store bearer tokens or responses, and it rejects every write or
other X API path.

## Deploy your own

1. Install and authenticate Wrangler: `npx wrangler login`.
2. Change `name` in `wrangler.toml` to a unique Worker name.
3. From this directory, run `npx wrangler deploy`.
4. In Sandevistan, open **BYOK Keys → X Relay → Customize relay**, then paste
   the deployed `https://<your-worker>.workers.dev` URL. Custom domains are
   intentionally not accepted: the app grants network access only to Cloudflare
   Workers URLs selected for this X-only purpose.

The packaged app permits `https://*.workers.dev` only for this user-selected
X relay. Sandevistan still sends only the two read-only X endpoints above; a
custom URL never changes the upstream host or unlocks arbitrary X API calls.

Use an OAuth 2.0 **User Access Token** in the separate X token field. Do not
place a Client Secret, app Bearer Token, or Refresh Token in this Worker or the
app.

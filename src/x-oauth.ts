import type { XOAuthConfig, XOAuthTokens } from "./x-key";

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";

const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const verifier = () => {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

const challengeFor = async (value: string) => base64Url(new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
));

const tokenRequest = async (
  config: XOAuthConfig,
  body: URLSearchParams,
  relayUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<XOAuthTokens> => {
  body.set("client_id", config.clientId);
  const response = await fetchImpl(`${relayUrl.replace(/\/$/, "")}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`X OAuth token exchange failed (${response.status})`);
  const json = await response.json() as {
    access_token?: string; refresh_token?: string; expires_in?: number;
  };
  if (!json.access_token || !json.refresh_token || !json.expires_in) {
    throw new Error("X OAuth response did not include renewable tokens");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1_000,
  };
};

export async function beginXOAuth(config: XOAuthConfig) {
  const codeVerifier = verifier();
  const state = verifier();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "tweet.read users.read offline.access",
    state,
    code_challenge: await challengeFor(codeVerifier),
    code_challenge_method: "S256",
  });
  return { codeVerifier, state, url: `${AUTHORIZE_URL}?${params}` };
}

export const exchangeXOAuthCode = (
  config: XOAuthConfig,
  code: string,
  codeVerifier: string,
  relayUrl: string,
) => tokenRequest(config, new URLSearchParams({
  grant_type: "authorization_code",
  code,
  redirect_uri: config.redirectUri,
  code_verifier: codeVerifier,
}), relayUrl);

export const refreshXOAuthTokens = (
  config: XOAuthConfig,
  refreshToken: string,
  relayUrl: string,
) => tokenRequest(config, new URLSearchParams({
  grant_type: "refresh_token",
  refresh_token: refreshToken,
}), relayUrl);

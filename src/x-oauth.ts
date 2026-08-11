import type { XOAuthConfig, XOAuthTokens } from "./x-key";

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

export const refreshXOAuthTokens = (
  config: XOAuthConfig,
  refreshToken: string,
  relayUrl: string,
) => tokenRequest(config, new URLSearchParams({
  grant_type: "refresh_token",
  refresh_token: refreshToken,
}), relayUrl);

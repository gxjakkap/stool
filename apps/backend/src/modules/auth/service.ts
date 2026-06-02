import * as client from "openid-client";
import { getSetting } from "../../db/client";
import type { SessionData } from "./model";

/** In-memory session store */
export const SESSIONS = new Map<string, SessionData>();

/** In-memory PKCE / state store */
const stateStore = new Map<string, { codeVerifier: string; state: string }>();

async function getOidcConfig() {
  const issuer = getSetting("oidc_issuer") ?? "";
  const clientId = getSetting("oidc_client_id") ?? "";
  const clientSecret = getSetting("oidc_client_secret") ?? "";
  const redirectUri =
    getSetting("oidc_redirect_uri") ?? "http://localhost:4000/auth/callback";

  if (!issuer || !clientId || !clientSecret) {
    throw new Error("OIDC not configured");
  }

  const config = await client.discovery(
    new URL(issuer),
    clientId,
    clientSecret
  );

  return { config, redirectUri };
}

export abstract class AuthService {
  static async beginLogin(): Promise<URL> {
    const { config, redirectUri } = await getOidcConfig();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    stateStore.set(state, { codeVerifier, state });

    return client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
  }

  static async handleCallback(
    callbackUrl: URL
  ): Promise<{ sessionId: string }> {
    const { config, redirectUri } = await getOidcConfig();
    const state = callbackUrl.searchParams.get("state") ?? "";
    const stored = stateStore.get(state);

    if (!stored) throw new Error("Invalid state");
    stateStore.delete(state);

    const tokenSet = await client.authorizationCodeGrant(
      config,
      callbackUrl,
      {
        pkceCodeVerifier: stored.codeVerifier,
        expectedState: stored.state,
      },
      { redirect_uri: redirectUri }
    );

    const claims = tokenSet.claims();
    const sessionId = crypto.randomUUID();

    SESSIONS.set(sessionId, {
      sub: claims?.sub ?? "unknown",
      email: claims?.email as string | undefined,
      name: claims?.name as string | undefined,
    });

    return { sessionId };
  }

  static getSession(sessionId: string): SessionData | undefined {
    return SESSIONS.get(sessionId);
  }

  static deleteSession(sessionId: string): void {
    SESSIONS.delete(sessionId);
  }
}

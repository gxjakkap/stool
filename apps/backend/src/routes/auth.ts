import Elysia from "elysia";
import * as client from "openid-client";
import { getSetting } from "../db/client";

const SESSIONS = new Map<string, { sub: string; email?: string; name?: string }>();

async function getOidcConfig() {
  const issuer = getSetting("oidc_issuer") ?? "";
  const clientId = getSetting("oidc_client_id") ?? "";
  const clientSecret = getSetting("oidc_client_secret") ?? "";
  const redirectUri = getSetting("oidc_redirect_uri") ?? "http://localhost:4000/auth/callback";

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

// In-memory PKCE / state store
const stateStore = new Map<string, { codeVerifier: string; state: string }>();

export const authRoutes = new Elysia({ prefix: "/auth" })
  .get("/login", async ({ redirect }) => {
    try {
      const { config, redirectUri } = await getOidcConfig();
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const state = client.randomState();

      stateStore.set(state, { codeVerifier, state });

      const authUrl = client.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      return redirect(authUrl.href);
    } catch (e: any) {
      return new Response(`OIDC Error: ${e.message}`, { status: 500 });
    }
  })
  .get("/callback", async ({ request, redirect, cookie }) => {
    try {
      const { config, redirectUri } = await getOidcConfig();
      const url = new URL(request.url);
      const state = url.searchParams.get("state") ?? "";
      const stored = stateStore.get(state);
      if (!stored) {
        return new Response("Invalid state", { status: 400 });
      }
      stateStore.delete(state);

      // openid-client v6: redirectUri goes in tokenEndpointParameters (4th arg)
      const tokenSet = await client.authorizationCodeGrant(
        config,
        url,
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

      // Elysia v1 built-in cookie API
      cookie.session.set({
        value: sessionId,
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 86400 * 7,
        path: "/",
      });

      return redirect(process.env.FRONTEND_ORIGIN ?? "/");
    } catch (e: any) {
      return new Response(`Auth Error: ${e.message}`, { status: 500 });
    }
  })
  .get("/logout", ({ cookie, redirect }) => {
    const sessionId = cookie.session.value as string | undefined;
    if (sessionId) {
      SESSIONS.delete(sessionId);
      cookie.session.remove();
    }
    return redirect("/login");
  })
  .get("/me", ({ cookie }) => {
    const sessionId = cookie.session.value as string | undefined;
    if (!sessionId) return new Response("Unauthorized", { status: 401 });
    const session = SESSIONS.get(sessionId);
    if (!session) return new Response("Unauthorized", { status: 401 });
    return session;
  });

export { SESSIONS };

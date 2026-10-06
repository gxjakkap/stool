import { createHash, randomBytes } from "node:crypto";
import { getSetting, setSetting } from "../db/client";

export type Platform = "twitch" | "kick";
export type Role = "bot" | "broadcaster";
export const PLATFORMS: Platform[] = ["twitch", "kick"];
export const ROLES: Role[] = ["bot", "broadcaster"];

const SCOPES: Record<Platform, Record<Role, string>> = {
  twitch: { bot: "chat:read chat:edit", broadcaster: "channel:manage:broadcast" },
  kick: { bot: "user:read chat:write", broadcaster: "user:read channel:read channel:write" },
};

const AUTHORIZE_URL: Record<Platform, string> = {
  twitch: "https://id.twitch.tv/oauth2/authorize",
  kick: "https://id.kick.com/oauth/authorize",
};

const TOKEN_URL: Record<Platform, string> = {
  twitch: "https://id.twitch.tv/oauth2/token",
  kick: "https://id.kick.com/oauth/token",
};

/** Settings keys holding OAuth secrets. Never returned by the settings API. */
export const isSecretKey = (key: string) => /_(access|refresh)_token$/.test(key);

const key = (p: Platform, r: Role, field: string) => `${p}_${r}_${field}`;

function appCreds(platform: Platform) {
  const clientId = getSetting(`${platform}_client_id`) ?? "";
  const clientSecret = getSetting(`${platform}_client_secret`) ?? "";
  if (!clientId || !clientSecret) throw new Error(`${platform} client id/secret not set`);
  return { clientId, clientSecret };
}

// ── Authorization code flow ───────────────────────────────────────────────────

const STATES = new Map<string, { platform: Platform; role: Role; verifier: string; redirectUri: string; expires: number }>();

export function beginAuth(platform: Platform, role: Role, redirectUri: string): string {
  const { clientId } = appCreds(platform);
  const state = randomBytes(16).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  for (const [s, v] of STATES) if (v.expires < Date.now()) STATES.delete(s);
  STATES.set(state, { platform, role, verifier, redirectUri, expires: Date.now() + 10 * 60_000 });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES[platform][role],
    state,
  });
  // Always show the login screen so the bot account can differ from the logged-in one
  if (platform === "twitch") params.set("force_verify", "true");
  if (platform === "kick") {
    params.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    params.set("code_challenge_method", "S256");
  }
  return `${AUTHORIZE_URL[platform]}?${params}`;
}

export async function finishAuth(state: string, code: string): Promise<{ platform: Platform; role: Role }> {
  const pending = STATES.get(state);
  STATES.delete(state);
  if (!pending || pending.expires < Date.now()) throw new Error("invalid or expired state");
  const { platform, role, verifier, redirectUri } = pending;
  const { clientId, clientSecret } = appCreds(platform);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  if (platform === "kick") body.set("code_verifier", verifier);
  storeTokens(platform, role, await tokenRequest(platform, body));

  const user = await fetchUser(platform, (await getUserToken(platform, role))!);
  setSetting(key(platform, role, "login"), user.login);
  setSetting(key(platform, role, "user_id"), user.id);
  return { platform, role };
}

async function tokenRequest(platform: Platform, body: URLSearchParams) {
  const res = await fetch(TOKEN_URL[platform], { method: "POST", body });
  if (!res.ok) throw new Error(`${platform} token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in?: number; expiry?: number };
}

function storeTokens(platform: Platform, role: Role, t: Awaited<ReturnType<typeof tokenRequest>>) {
  const expiresIn = t.expires_in ?? t.expiry ?? 3600;
  setSetting(key(platform, role, "access_token"), t.access_token);
  setSetting(key(platform, role, "refresh_token"), t.refresh_token);
  setSetting(key(platform, role, "expires_at"), String(Date.now() + expiresIn * 1000));
}

async function fetchUser(platform: Platform, token: string): Promise<{ id: string; login: string }> {
  if (platform === "twitch") {
    const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
    if (!res.ok) throw new Error(`twitch validate failed: ${res.status}`);
    const j = (await res.json()) as { user_id: string; login: string };
    return { id: j.user_id, login: j.login };
  }
  const res = await fetch("https://api.kick.com/public/v1/users", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`kick users failed: ${res.status}`);
  const u = ((await res.json()) as { data: { user_id: number; name: string }[] }).data[0];
  return { id: String(u.user_id), login: u.name };
}

// ── Token access ──────────────────────────────────────────────────────────────

export function accountInfo(platform: Platform, role: Role): { login: string; userId: string } | null {
  if (!getSetting(key(platform, role, "refresh_token"))) return null;
  return { login: getSetting(key(platform, role, "login")) ?? "", userId: getSetting(key(platform, role, "user_id")) ?? "" };
}

export function disconnect(platform: Platform, role: Role): void {
  for (const f of ["access_token", "refresh_token", "expires_at", "login", "user_id"]) setSetting(key(platform, role, f), "");
}

const refreshing = new Map<string, Promise<void>>();

async function refresh(platform: Platform, role: Role): Promise<void> {
  const k = `${platform}:${role}`;
  let p = refreshing.get(k);
  if (!p) {
    p = (async () => {
      const { clientId, clientSecret } = appCreds(platform);
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: getSetting(key(platform, role, "refresh_token")) ?? "",
        client_id: clientId,
        client_secret: clientSecret,
      });
      try {
        storeTokens(platform, role, await tokenRequest(platform, body));
      } catch (e) {
        console.error(`[OAuth] ${platform} ${role} refresh failed, disconnecting:`, e);
        disconnect(platform, role);
        throw e;
      }
    })().finally(() => refreshing.delete(k));
    refreshing.set(k, p);
  }
  return p;
}

/** Current user access token, refreshed when within a minute of expiry. Null if not connected. */
export async function getUserToken(platform: Platform, role: Role): Promise<string | null> {
  if (!getSetting(key(platform, role, "refresh_token"))) return null;
  if (Number(getSetting(key(platform, role, "expires_at")) ?? 0) < Date.now() + 60_000) await refresh(platform, role);
  return getSetting(key(platform, role, "access_token"));
}

/** fetch with the user's bearer token; refreshes and retries once on 401. */
export async function userFetch(platform: Platform, role: Role, url: string, init: RequestInit = {}): Promise<Response> {
  const send = async () => {
    const token = await getUserToken(platform, role);
    if (!token) throw new Error(`${platform} ${role} account not connected`);
    return fetch(url, { ...init, headers: { ...authHeaders(platform, token), ...init.headers } });
  };
  const res = await send();
  if (res.status !== 401) return res;
  await refresh(platform, role);
  return send();
}

function authHeaders(platform: Platform, token: string): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (platform === "twitch") h["Client-Id"] = appCreds(platform).clientId;
  return h;
}

const appTokens = new Map<Platform, { token: string; expires: number }>();

/** Client credentials token for public reads. */
export async function appFetch(platform: Platform, url: string, init: RequestInit = {}): Promise<Response> {
  let cached = appTokens.get(platform);
  if (!cached || cached.expires < Date.now() + 60_000) {
    const { clientId, clientSecret } = appCreds(platform);
    const t = await tokenRequest(
      platform,
      new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret })
    );
    cached = { token: t.access_token, expires: Date.now() + (t.expires_in ?? t.expiry ?? 3600) * 1000 };
    appTokens.set(platform, cached);
  }
  const res = await fetch(url, { ...init, headers: { ...authHeaders(platform, cached.token), ...init.headers } });
  if (res.status === 401) appTokens.delete(platform);
  return res;
}

import { Elysia, t } from "elysia";
import { accountInfo, beginAuth, disconnect, finishAuth, PLATFORMS, ROLES } from "../../services/oauth";
import { chatManager } from "../../services/chat-manager";
import { authGuard } from "../auth/guard";
import { getSetting } from "../../db/client";

/** Only the Twitch connector logs in as the bot; Kick sends over REST with the stored token. */
function reconnectTwitch(p: string, r: string) {
  if (p === "twitch" && r === "bot") chatManager.startTwitch(getSetting("twitch_channel") ?? "").catch(console.error);
}

const platform = t.Union([t.Literal("twitch"), t.Literal("kick")]);
const role = t.Union([t.Literal("bot"), t.Literal("broadcaster")]);
const login = t.Union([t.String(), t.Null()]);
const perPlatform = <T extends import("elysia").TSchema>(v: T) => t.Object({ twitch: v, kick: v });
const statusResponse = t.Object({
  accounts: perPlatform(t.Object({ bot: login, broadcaster: login })),
  redirectUris: perPlatform(t.String()),
});

/** Public origin of this backend as the browser sees it (respects a reverse proxy). */
function originOf(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

const callbackUri = (request: Request, p: string) => `${originOf(request)}/api/bot/oauth/${p}/callback`;
const settingsPage = () => `${process.env.FRONTEND_ORIGIN ?? "http://localhost:3000"}/settings`;

export const botRoutes = new Elysia({ prefix: "/api/bot" })
  // Not session-guarded: the provider redirects here; the one-time state ties it to a guarded /start
  .get(
    "/oauth/:platform/callback",
    async ({ query, redirect }) => {
      try {
        if (query.error || !query.code || !query.state) throw new Error(query.error_description ?? query.error ?? "missing code");
        const { platform, role } = await finishAuth(query.state, query.code);
        reconnectTwitch(platform, role);
        return redirect(`${settingsPage()}?bot_connected=${platform}_${role}`);
      } catch (e) {
        console.error("[Bot] OAuth callback failed:", e);
        return redirect(`${settingsPage()}?bot_error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`);
      }
    },
    {
      params: t.Object({ platform }),
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
        error_description: t.Optional(t.String()),
      }),
    }
  )
  .use(authGuard)
  .get(
    "/status",
    ({ request }) => ({
      accounts: Object.fromEntries(
        PLATFORMS.map((p) => [p, Object.fromEntries(ROLES.map((r) => [r, accountInfo(p, r)?.login ?? null]))])
      ) as typeof statusResponse.static.accounts,
      redirectUris: Object.fromEntries(PLATFORMS.map((p) => [p, callbackUri(request, p)])) as typeof statusResponse.static.redirectUris,
    }),
    { response: { 200: statusResponse } }
  )
  .get(
    "/oauth/:platform/:role/start",
    ({ params, request, redirect, status }) => {
      try {
        return redirect(beginAuth(params.platform, params.role, callbackUri(request, params.platform)));
      } catch (e) {
        return status(400, e instanceof Error ? e.message : String(e));
      }
    },
    { params: t.Object({ platform, role }) }
  )
  .post(
    "/oauth/:platform/:role/disconnect",
    ({ params }) => {
      disconnect(params.platform, params.role);
      reconnectTwitch(params.platform, params.role);
      return { ok: true };
    },
    { params: t.Object({ platform, role }) }
  );

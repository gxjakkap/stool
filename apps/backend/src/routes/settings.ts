import Elysia from "elysia";
import { getAllSettings, getSetting, setSetting } from "../db/client";
import { chatManager } from "../services/chat-manager";
import { requireAuth } from "../middleware/auth-guard";

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  .use(requireAuth)
  .get("/", () => {
    return getAllSettings();
  })
  .put("/", async ({ body }) => {
    for (const [key, value] of Object.entries(body as Record<string, string>)) {
      setSetting(key, String(value));
    }
    // Restart chat connectors if channel settings changed
    const channelKeys = ["twitch_channel", "youtube_channel_id", "youtube_api_key", "tiktok_username"];
    const hasChannelChange = Object.keys(body as object).some((k) => channelKeys.includes(k));
    if (hasChannelChange) {
      chatManager.restartFromSettings().catch(console.error);
    }
    return { ok: true };
  })
  .get("/:key", ({ params }) => {
    const value = getSetting(params.key);
    if (value === null) return new Response("Not found", { status: 404 });
    return { key: params.key, value };
  });

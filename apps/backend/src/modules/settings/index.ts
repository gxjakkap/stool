import { Elysia } from "elysia";
import { getAllSettings, getSetting, setSetting } from "../../db/client";
import { chatManager } from "../../services/chat-manager";
import { SettingsModel } from "./model";
import { authGuard } from "../auth/guard";

const CHANNEL_KEYS = [
  "twitch_channel",
  "youtube_channel_id",
  "youtube_api_key",
  "tiktok_username",
];

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  .model({
    "settings.map": SettingsModel.settingsMap,
    "settings.single": SettingsModel.singleSetting,
    "settings.keyParams": SettingsModel.keyParams,
    "settings.okResponse": SettingsModel.okResponse,
  })
  .use(authGuard)
  .get("/", () => getAllSettings(), {
    response: { 200: "settings.map" },
  })
  .put(
    "/",
    async ({ body }) => {
      for (const [key, value] of Object.entries(body)) {
        setSetting(key, value);
      }
      const hasChannelChange = Object.keys(body).some((k) =>
        CHANNEL_KEYS.includes(k)
      );
      if (hasChannelChange) {
        chatManager.restartFromSettings().catch(console.error);
      }
      return { ok: true };
    },
    {
      body: "settings.map",
      response: { 200: "settings.okResponse" },
    }
  )
  .get(
    "/:key",
    ({ params }) => {
      const value = getSetting(params.key);
      if (value === null) return new Response("Not found", { status: 404 });
      return { key: params.key, value };
    },
    {
      params: "settings.keyParams",
      response: { 200: "settings.single" },
    }
  );

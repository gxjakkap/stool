import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), "stool.db");

export const db = new Database(DB_PATH, { create: true });

export function migrate(): void {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS overlay_tokens (
      token TEXT PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS donation (
      id INTEGER PRIMARY KEY,
      ref_no TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      donator_name TEXT NOT NULL,
      donate_message TEXT,
      amount NUMERIC NOT NULL,
      time INTEGER NOT NULL,
      read BOOLEAN DEFAULT FALSE
    )
  `);

  const defaults: Record<string, string> = {
    twitch_channel: process.env.TWITCH_CHANNEL ?? "",
    youtube_channel_id: process.env.YOUTUBE_CHANNEL_ID ?? "",
    youtube_api_key: process.env.YOUTUBE_API_KEY ?? "",
    tiktok_username: process.env.TIKTOK_USERNAME ?? "",
    overlay_expire_seconds: "30",
    overlay_max_messages: "20",
    overlay_font_size: "16",
    overlay_animation_speed: "normal",
    overlay_theme: "dark",
    oidc_issuer: process.env.OIDC_ISSUER ?? "",
    oidc_client_id: process.env.OIDC_CLIENT_ID ?? "",
    oidc_client_secret: process.env.OIDC_CLIENT_SECRET ?? "",
    oidc_redirect_uri: process.env.OIDC_REDIRECT_URI ?? "http://localhost:4000/auth/callback",
  };

  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING`
  );

  for (const [key, value] of Object.entries(defaults)) {
    upsert.run(key, value);
  }
}

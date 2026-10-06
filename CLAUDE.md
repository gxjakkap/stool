# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Behavioral Guidelines
* NEVER use emojis in code, comments, or documentation.
* NEVER include emojis in commit messages, PRs, or responses.
* NEVER use em dashes (—), en dashes (–), or double hyphens (--) anywhere in the output or code comments.
* Stick strictly to plain text and ASCII characters.


## Commands

**Package manager:** Bun (v1.3.9). Use `bun` for all installs and script runs — not npm/yarn.

```bash
# Install dependencies
bun install

# Dev (both apps in parallel via Turborepo)
bun dev

# Build
bun build

# Lint (frontend only — ESLint)
bun lint

# Run backend only (hot-reload, loads root .env)
cd apps/backend && bun run --env-file=../../.env --hot src/index.ts

# Run frontend only
cd apps/frontend && bun run dev
```

Environment variables are loaded from the **root `.env`** file (see `.env.example`). The backend reads it via `--env-file=../../.env`; the frontend reads `VITE_API_ORIGIN` at build time (and at runtime via `window.ENV` injected by `entrypoint.sh` in Docker).

## Architecture

Turborepo monorepo with two apps:

```
apps/
  backend/   — Bun + Elysia HTTP/WebSocket server
  frontend/  — React 19 + Vite SPA
```

### Backend (`apps/backend/src/`)

**Entry point:** `index.ts` — mounts all Elysia route plugins, runs DB migrations, and starts chat connectors on boot.

**Database:** Bun's built-in SQLite (`bun:sqlite`). `db/schema.ts` holds the schema and `migrate()` function (idempotent via `CREATE TABLE IF NOT EXISTS`). `db/client.ts` exposes typed helpers (`getSetting`, `setSetting`, `addDonation`, etc.). The DB file is `stool.db` at the working directory (overridable via `DB_PATH`).

**Module structure** — each feature is an Elysia plugin in `modules/<name>/`:
- `auth/` — OIDC login flow (openid-client). Sessions stored in an in-memory `Map` (`SESSIONS`). Routes: `GET /auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me`.
- `settings/` — CRUD for key/value settings table. Saving settings triggers connector restarts.
- `token/` — Overlay token management (`overlay_tokens` table). Tokens allow unauthenticated WebSocket access for OBS browser sources.
- `ws/` — WebSocket endpoint at `/ws`. Auth via session cookie **or** `?token=` query param. On connect: sends current emote cache, current TikTok status, then subscribes to `chatManager` and `emoteCache`.
- `webhook/` — `POST /api/webhook/ezdn` receives donations from ezdn, persists them, and broadcasts a `DonationMessage` via `chatManager`. `POST /api/webhook/kick` receives Kick events, verifies the RSA signature, and broadcasts them.
- `tts/` — `GET /api/tts?text=&voice=` proxies Google Translate TTS and returns base64 audio.
- `commands/`: bot command and timer CRUD, `POST /api/commands/test`, public `GET /api/commands/public`.
- `bot/`: bot/broadcaster account OAuth (`/api/bot/oauth/...`) and `GET /api/bot/status`.

**Services** (singletons in `services/`):
- `chat-manager.ts` — `ChatManager` singleton. Holds connector instances and a `Set` of subscriber callbacks. All connectors call `chatManager.broadcast(msg)` to fan-out to WebSocket clients. `restartFromSettings()` is called on startup and after settings saves.
- `emote-cache.ts` — fetches and caches Twitch emotes (via `@mkody/twitch-emoticons`), pushes to WS clients on update.
- `tts.ts` — `TtsService.generate(text, lang)` — calls Google Translate TTS, returns base64 data URI.
- `bot.ts`: chat bot for Twitch and Kick: custom commands plus built-ins (`!addcom`, `!editcom`, `!delcom`, `!commands`, `!title`, `!game`, `!uptime`). Spec: `docs/specs/chat-bot.md`.
- `macro.ts`: renders `${ expr }` segments in a QuickJS WASM sandbox with a restricted `fetch` (public addresses only).
- `timers.ts`: posts timer messages while live, gated by interval and chat activity per platform.
- `oauth.ts`: OAuth token storage/refresh for bot and broadcaster accounts; `platform-api.ts`: stream info, title/category updates, Kick chat send.

**Connectors** (`connectors/`): `twitch.ts` (tmi.js), `youtube.ts` (googleapis polling), `tiktok.ts` (tiktok-live-connector), `kick.ts` (official Kick API: on start it recreates webhook event subscriptions with an app access token; events arrive via the webhook route). Each wraps a third-party library and normalizes events into the shared `WsMessage` union.

**Shared types** (`types.ts`): `ChatMessage`, `PlatformEventMessage` (TikTok and Kick gifts/follows/subs), `DonationMessage`, `SystemStatusMessage`, `WsMessage` union. These are the canonical types — the frontend duplicates them in `lib/ws.ts` (keep in sync manually).

**Auth model:** OIDC configured via settings (`oidc_issuer`, `oidc_client_id`, etc.). Sessions are in-memory only — they are lost on server restart.

### Frontend (`apps/frontend/src/`)

React 19 SPA served by Vite (dev) or Nginx (Docker). Routing via react-router-dom v7.

**Routes:**
- `/overlay` — public chat overlay (OBS browser source), uses `?token=` for WS auth
- `/donation-overlay` — public donation alert overlay
- `/login` → `/auth/callback` — OIDC login flow
- `/chat` — protected main chat view
- `/settings` — protected settings page

**Key abstractions:**
- `lib/ws.ts` — `useChat(token?)` hook. Manages WebSocket lifecycle, auto-reconnect (3 s), message deduplication by `id`, and exposes `messages`, `connected`, `tiktokStatus`, `clearMessages`.
- `lib/api.ts` — typed fetch wrappers for all REST endpoints. `BASE` URL resolved from `window.ENV.VITE_API_ORIGIN` (Docker runtime injection) → `import.meta.env.VITE_API_ORIGIN` (build-time) → `''` (same-origin fallback).
- `lib/emotes.ts` — receives emote dictionary from WS `{ type: 'emotes' }` message and makes emote URLs available for chat rendering.

**UI:** Tailwind CSS v4 + Radix UI primitives + shadcn-style components in `components/ui/`. Lucide icons.

### Runtime env injection (Docker)

`apps/frontend/entrypoint.sh` writes `window.ENV = { VITE_API_ORIGIN: "..." }` into `/usr/share/nginx/html/env.js` at container start. This allows runtime configuration without rebuilding the image. `index.html` must include `<script src="/env.js">` for this to work.

### Deployment

`docker-compose.yml` pulls prebuilt images from GHCR (`ghcr.io/<GITHUB_REPOSITORY>-be` / `-fe`). Backend data persisted in Docker volume `stool_data` mounted at `/data` (`DB_PATH=/data/stool.db`).

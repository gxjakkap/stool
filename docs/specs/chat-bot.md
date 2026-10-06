# Chat Bot Spec

Cross-platform chat bot for stool, replacing guntxbot. Status: implemented on `feat/chat-bot`.

## Scope

In v1:
- Twitch and Kick.
- Custom commands with inline JavaScript macros, managed from chat and the dashboard.
- Built-ins: `!commands`, `!title`, `!game`, `!uptime`.
- Timers.

Out of scope (v1):
- YouTube bot (sending needs OAuth and 50 quota units per message; polling quota fix is a separate task).
- Cooldowns / rate limiting.
- Persistent macro state (counters like `!deaths`).
- Importing the old Firestore commands (re-added manually).

## Storage

SQLite (`bun:sqlite`), same DB file. Command lookups are primary-key reads on a small table; writes are rare. Single backend instance, so no contention concerns.

Triggers are stored lowercased (`!discord`, `555`, `นน`). `response` and `message` may contain `${ }` macro segments. `created_by` is a display name or `dashboard`. `platforms` is comma-separated, e.g. `twitch,kick`.

```sql
CREATE TABLE IF NOT EXISTS commands (
  trigger TEXT PRIMARY KEY,
  response TEXT NOT NULL,
  prefix_user BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS timers (
  id INTEGER PRIMARY KEY,
  message TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL,
  min_lines INTEGER NOT NULL DEFAULT 0,
  platforms TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);
```

OAuth tokens live in `settings` (keys below). New settings:

For each `<platform>` in `twitch|kick` and `<role>` in `bot|broadcaster`:

| Key | Purpose |
|-----|---------|
| `<platform>_<role>_access_token`, `<platform>_<role>_refresh_token` | OAuth tokens (secret) |
| `<platform>_<role>_expires_at` | Access token expiry, unix ms |
| `<platform>_<role>_login`, `<platform>_<role>_user_id` | Connected account |

Both platforms use their existing `<platform>_client_id` / `<platform>_client_secret` app settings.

Token secrets must never be returned by `GET /api/settings`; the API returns only whether each account is connected and its username.

## Accounts and OAuth

Settings gets, per platform, "Connect bot account" and "Connect broadcaster account" buttons.

- Routes: `GET /api/bot/oauth/:platform/:role/start` (session-protected) redirects to the provider. The provider returns to `GET /api/bot/oauth/:platform/callback` (one URI per platform; the role travels in the one-time `state`, which expires after 10 minutes). Kick uses PKCE. `POST /api/bot/oauth/:platform/:role/disconnect` clears an account.
- Scopes:
  - Twitch bot: `chat:read chat:edit user:write:chat moderator:manage:chat_messages` (the last two are for the pinned message; a bot connected before them must reconnect).
  - Twitch broadcaster: `channel:manage:broadcast`.
  - Kick bot: `user:read chat:write`.
  - Kick broadcaster: `user:read channel:read channel:write`.
- Refresh: tokens are refreshed when within a minute of expiry and retried once on 401, then the new pair is persisted. A failed refresh clears the account (shown as disconnected) and logs it.
- Redirect URIs must be registered in the Twitch and Kick developer consoles; Settings shows the exact URI to copy.

## Connectors

- **Twitch:** when a bot token exists, `TwitchConnector` connects with `identity: { username: twitch_bot_login, password: "oauth:<token>" }`; otherwise anonymous as today. Adds `say(text)`. Own messages (`self === true`) are ignored for commands and timer gates but still broadcast to the overlay.
- **Kick:** reads unchanged (webhook). Sending via `POST https://api.kick.com/public/v1/chat` with the bot token (`type: "user"`, `broadcaster_user_id`, `content`). Messages whose sender `user_id` equals `kick_bot_user_id` are ignored for commands and timer gates.
- `ChatMessage` gains `isSelf`. Mod status comes from the existing `badges` (`moderator` or `broadcaster`) on both platforms.
  - Twitch: tmi `self`, or username equal to the bot login.
  - Kick: sender `user_id` equal to `kick_bot_user_id`.

## Bot service (`services/bot.ts`)

Subscribes to `chatManager`. For each incoming `ChatMessage` (not `isSelf`, platform in `twitch|kick`):

1. Increment the per-platform line counter (used by timer gates).
2. `trigger = firstWord.toLowerCase()`, `query = rest of message`, `args = query.split(/\s+/)` (empty when no rest).
3. If `trigger` is a built-in, run it.
4. Else look up `commands` by `trigger`. If found, render the response (macros below), prepend `@user ` if `prefix_user`, truncate to 400 chars, and reply on the originating platform.

Replies go through `chatManager.say(platform, text)`, which routes to the right connector. No cooldowns.

Permission "mod" means `isMod || isBroadcaster`.

## Built-in commands

Reserved (cannot be used as custom triggers): `!addcom`, `!editcom`, `!delcom`, `!commands`, `!title`, `!game`, `!uptime`.

| Command | Who | Behavior |
|---------|-----|----------|
| `!addcom [-noprefix] <trigger> <response>` | mod | Create. Fails if it exists or is reserved. Trigger stored lowercased. |
| `!editcom [-noprefix\|-prefix] <trigger> <response>` | mod | Replace response; flag optional, unchanged if omitted. |
| `!delcom <trigger>` | mod | Delete. |
| `!commands` | anyone | Replies with the public command list URL. |
| `!title` | anyone | Current title on the chatter's platform. |
| `!title <text>` | mod | Sets title on every platform with a connected broadcaster account. Reply lists failures, e.g. `Title updated (Kick: failed)`. |
| `!game` | anyone | Current category on the chatter's platform. |
| `!game <name>` | mod | Per platform: exact case-insensitive name match, else top search result. Sets where found. Reply names the category set and lists failures, e.g. `Game set to VALORANT (Kick: not found)`. |
| `!uptime` | anyone | Uptime counted from the earliest `started_at` among live platforms; `offline` if none live. |

Usage errors reply with the usage string, as guntxbot did. Non-mods using a mod-only form get `you don't have permission to use this command`.

Platform APIs (verify exact shapes during implementation):
- **Twitch** (Helix, app or broadcaster token):
  - `GET /streams?user_login=` for live status, `started_at` and the current title/game.
  - `GET /channels?broadcaster_id=` for the title and game when offline.
  - `GET /games?name=` for an exact match, then `GET /search/categories?query=` as the fallback.
  - `PATCH /channels?broadcaster_id=` with `title` / `game_id`.
- **Kick:**
  - `GET /public/v1/channels?slug=` for `stream.is_live`, `stream.start_time`, `stream_title` and `category`.
  - `GET /public/v1/categories?q=` for search.
  - `PATCH /public/v1/channels` with `stream_title` / `category_id`.

## Macros

### Syntax

Any `${ expr }` in a command response or timer message is an awaited JavaScript expression. Text outside segments is literal. `\${` produces a literal `${`.

```
!addcom !valrank ${fetch("https://api.example.com/val/jakka").then(r => r.json()).then(d => `${d.rankName} ${d.rankLevel} ${d.rating}RR`)}
!addcom -noprefix !hug ${user} hugs ${args[0] ?? "everyone"}
```

Multi-statement code uses an async IIFE: `${(async () => { ... })()}`.

Parsing: scan for `${`, then find the matching `}` by brace depth while skipping over string literals (`'`, `"`) and template literals (including nested `${}`). Unterminated segment is a render error. Segments run in order; each result is converted with `String()`, with `null`/`undefined` rendered as empty.

### Globals available in segments

| Name | Value |
|------|-------|
| `user` | Chatter display name (timers: empty string) |
| `args` | `string[]` of words after the trigger |
| `query` | Raw text after the trigger |
| `platform` | `"twitch"` or `"kick"` |
| `fetch(url, init?)` | Host-provided, restricted (below). Returns `{ ok, status, text(), json() }`. |

No other host APIs (no timers, no console output to chat, no Node/Bun modules).

### Sandbox

- Runtime: QuickJS compiled to WASM (`quickjs-emscripten`). Fresh context per render; nothing shared between runs.
- Limits: 5 s wall-clock deadline per render via interrupt handler, plus memory limit (e.g. 16 MB) and stack limit.
- Host promises: `fetch` is implemented on the host and bridged with `context.newPromise`. Pending jobs are driven until all segments settle or the deadline passes.
- Final output is truncated to 400 chars (before the `@user ` prefix is applied).

### fetch restrictions

- Only `http:` / `https:`.
- Resolve the hostname and reject loopback, private (RFC 1918), link-local (incl. `169.254.169.254`), CGNAT, unique-local IPv6, and unspecified addresses.
- Redirects followed manually, max 3, re-checking each hop.
- 5 s timeout, 1 MB response cap.
- `// ponytail:` known ceiling: resolve-then-fetch is open to DNS rebinding. Upgrade path is pinning the resolved IP for the connection.

### Errors

Any parse, runtime, timeout or fetch error: chat gets `@user command failed`, and the full error is logged with the trigger. The dashboard "Test" button renders a response with sample inputs and shows the full output or error.

## Timers (`services/timers.ts`)

- Dashboard-managed only.
- A 30 s tick checks each enabled timer. For each platform in `timer.platforms`, the timer posts when all of these hold:
  - the platform is live;
  - at least `interval_minutes` have passed since it last fired on that platform;
  - at least `min_lines` chat lines (excluding the bot's own) have arrived on that platform since it last fired there.
- Messages are rendered through the macro engine with `user = ""`, `args = []`, `query = ""`.
- Last-fired times and line counters are kept in memory; a restart resets them, which is acceptable.
- Live status is cached from the uptime/title APIs and refreshed at most once a minute per platform.

## Pinned message (`services/timers.ts`)

- One template in the `pinned_message` setting, edited on the dashboard's Pinned tab. Empty disables it.
- The timer tick posts it once per stream on each platform that is live and has a bot account. The stream's start time is stored in `pinned_message_<platform>_stream`, so a restart mid-stream does not repost. It is stored before sending, so a failure is logged and not retried until the next stream.
- Rendered through the macro engine like timers.
- Twitch: sent by the bot via Helix `POST /chat/messages` (IRC returns no message id), then pinned with `PUT /chat/pins` with no duration, which pins until the stream ends. The bot must be a moderator.
- Kick: the public API has no pin endpoint, so the message is only sent.

## HTTP API

Session-protected unless noted. Added to the Eden treaty types.

| Route | Purpose |
|-------|---------|
| `GET /api/commands/public` | **Public.** `[{ trigger, response }]`; `response` is null for macros, since macro source can contain API keys. |
| `GET /api/commands` | Full list `[{ trigger, response, prefixUser }]`. |
| `POST /api/commands` | Create `{ trigger, response, prefixUser }`. 400 invalid/reserved, 409 exists. |
| `PUT /api/commands` | Update by `trigger` in the body. 404 if missing. |
| `DELETE /api/commands?trigger=` | Delete. 404 if missing. |
| `POST /api/commands/test` | `{ response, user?, args?, platform? }` returns `{ output }` or `{ error }`. |
| `GET/POST /api/timers`, `PUT/DELETE /api/timers/:id` | Timer CRUD. |
| `GET /api/bot/status` | Connected bot/broadcaster logins per platform, plus the redirect URI to register. |
| `/api/bot/oauth/...` | OAuth (see above). |

Triggers travel in the body or query rather than the path, because they can contain `!` and non-ASCII text.

`GET /api/settings` filters out `*_access_token` / `*_refresh_token`, and `PUT /api/settings` ignores them.

Validation at the boundary:
- A trigger is one word, no whitespace, at most 50 chars, and not reserved.
- A response is at most 2000 chars.
- A timer interval is at least 1 minute, and `platforms` must be a subset of `twitch,kick`.

## Frontend

- `/settings/commands` (protected): Commands tab (add / edit / delete, prefix checkbox, Test button with sample args) and Timers tab.
- `/commands` (public, same path as the old bot.guntxjakka.me/commands): read-only list; macros show as "dynamic". `!commands` links here.
- `/settings`: new Bot tab with connect / reconnect / disconnect for each platform and role, and the redirect URI to register. The Twitch and Kick Client ID / Secret stay on the Channels tab.
- `ChatMessage` in `lib/ws.ts` gains `isSelf`.

## Checks

One small test file each:
- `services/bot.test.ts`: trigger parsing, `-noprefix` handling, reserved names, permission gate.
- `services/macro.test.ts`:
  - segment parsing (nested braces, strings, template literals, `\${`) and render output;
  - timeout enforcement;
  - fetch rejecting `localhost`, `10.0.0.1` and `169.254.169.254`.

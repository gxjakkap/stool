import { getSetting } from "../db/client";
import { accountInfo, appFetch, userFetch, type Platform } from "./oauth";

const HELIX = "https://api.twitch.tv/helix";
const KICK = "https://api.kick.com/public/v1";

export interface StreamInfo {
  live: boolean;
  startedAt?: number;
  title: string;
  category: string;
}

export const channelOf = (p: Platform) => getSetting(`${p}_channel`) ?? "";

async function json(res: Response): Promise<any> {
  if (!res.ok) throw new Error(`${res.url} ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const cache = new Map<Platform, { at: number; info: StreamInfo }>();

/** Stream state for the configured channel, cached for up to maxAgeMs. Null when no channel is set. */
export async function getStreamInfo(platform: Platform, maxAgeMs = 60_000): Promise<StreamInfo | null> {
  const channel = channelOf(platform);
  if (!channel) return null;
  const hit = cache.get(platform);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.info;
  const info = platform === "twitch" ? await twitchInfo(channel) : await kickInfo(channel);
  cache.set(platform, { at: Date.now(), info });
  return info;
}

async function twitchInfo(login: string): Promise<StreamInfo> {
  const stream = (await json(await appFetch("twitch", `${HELIX}/streams?user_login=${encodeURIComponent(login)}`))).data[0];
  if (stream) return { live: true, startedAt: Date.parse(stream.started_at), title: stream.title, category: stream.game_name };
  const id = await twitchUserId(login);
  const ch = (await json(await appFetch("twitch", `${HELIX}/channels?broadcaster_id=${id}`))).data[0];
  return { live: false, title: ch?.title ?? "", category: ch?.game_name ?? "" };
}

const twitchIds = new Map<string, string>();
async function twitchUserId(login: string): Promise<string> {
  let id = twitchIds.get(login);
  if (!id) {
    const user = (await json(await appFetch("twitch", `${HELIX}/users?login=${encodeURIComponent(login)}`))).data[0];
    if (!user) throw new Error(`twitch user "${login}" not found`);
    id = user.id as string;
    twitchIds.set(login, id);
  }
  return id;
}

async function kickChannel(slug: string): Promise<any> {
  const ch = (await json(await appFetch("kick", `${KICK}/channels?slug=${encodeURIComponent(slug.toLowerCase())}`))).data[0];
  if (!ch) throw new Error(`kick channel "${slug}" not found`);
  return ch;
}

async function kickInfo(slug: string): Promise<StreamInfo> {
  const ch = await kickChannel(slug);
  const live = !!ch.stream?.is_live;
  return {
    live,
    startedAt: live && ch.stream.start_time ? Date.parse(ch.stream.start_time) : undefined,
    title: ch.stream_title ?? "",
    category: ch.category?.name ?? "",
  };
}

let kickBroadcasterId: { slug: string; id: number } | null = null;
export async function kickBroadcasterUserId(): Promise<number> {
  const slug = channelOf("kick");
  if (kickBroadcasterId?.slug !== slug) kickBroadcasterId = { slug, id: (await kickChannel(slug)).broadcaster_user_id };
  return kickBroadcasterId.id;
}

// ── Updates (broadcaster token) ───────────────────────────────────────────────

function twitchBroadcasterId(): string {
  const acct = accountInfo("twitch", "broadcaster");
  if (!acct) throw new Error("broadcaster account not connected");
  return acct.userId;
}

async function patchChannel(platform: Platform, body: object): Promise<void> {
  const url = platform === "twitch" ? `${HELIX}/channels?broadcaster_id=${twitchBroadcasterId()}` : `${KICK}/channels`;
  await json(await userFetch(platform, "broadcaster", url, { method: "PATCH", body: JSON.stringify(body) }));
  cache.delete(platform);
}

export function setTitle(platform: Platform, title: string): Promise<void> {
  return patchChannel(platform, platform === "twitch" ? { title } : { stream_title: title });
}

/** Exact case-insensitive name match, else the top search result. Returns the category name set. */
export async function setCategory(platform: Platform, query: string): Promise<string> {
  const url =
    platform === "twitch"
      ? `${HELIX}/search/categories?first=20&query=${encodeURIComponent(query)}`
      : `${KICK}/categories?q=${encodeURIComponent(query)}`;
  const results = ((await json(await appFetch(platform, url))).data ?? []) as { id: string | number; name: string }[];
  const pick = results.find((c) => c.name.toLowerCase() === query.toLowerCase()) ?? results[0];
  if (!pick) throw new Error("not found");
  await patchChannel(platform, platform === "twitch" ? { game_id: String(pick.id) } : { category_id: Number(pick.id) });
  return pick.name;
}

// ── Chat (bot token) ──────────────────────────────────────────────────────────

export async function sendKickChat(content: string): Promise<void> {
  await json(
    await userFetch("kick", "bot", `${KICK}/chat`, {
      method: "POST",
      body: JSON.stringify({ broadcaster_user_id: await kickBroadcasterUserId(), content, type: "user" }),
    })
  );
}

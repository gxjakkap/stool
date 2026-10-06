import { createVerify } from "node:crypto";
import type { ChatMessage, PlatformEventMessage } from "../types";

const API = "https://api.kick.com/public/v1";

const EVENTS = [
  "chat.message.sent",
  "channel.followed",
  "channel.subscription.new",
  "channel.subscription.renewal",
  "channel.subscription.gifts",
  "kicks.gifted",
].map((name) => ({ name, version: 1 }));

/**
 * Kick delivers events via webhooks (POST /api/webhook/kick), so there is no
 * live connection. start() only (re)creates the app's event subscriptions.
 */
export class KickConnector {
  constructor(
    private channel: string,
    private clientId: string,
    private clientSecret: string
  ) {}

  async start(): Promise<void> {
    const tokenRes = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token request failed: ${tokenRes.status}`);
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const api = async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
      return res.status === 204 ? null : res.json();
    };

    // Delete every subscription this app owns so a channel change leaves nothing stale behind
    const existing = (await api("/events/subscriptions")).data as { id: string }[];
    if (existing.length) {
      const ids = new URLSearchParams(existing.map((s) => ["id", s.id]));
      await api(`/events/subscriptions?${ids}`, { method: "DELETE" });
    }

    if (!this.channel) return;

    const slug = encodeURIComponent(this.channel.toLowerCase());
    const channel = (await api(`/channels?slug=${slug}`)).data[0];
    if (!channel) throw new Error(`channel "${this.channel}" not found`);

    const created = (await api("/events/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        broadcaster_user_id: channel.broadcaster_user_id,
        events: EVENTS,
        method: "webhook",
      }),
    })).data as { name: string; error?: string }[];
    for (const s of created) {
      if (s.error) console.error(`[Kick] Subscribe ${s.name} failed: ${s.error}`);
    }
    console.log(`[Kick] Subscribed to events for ${this.channel}`);
  }
}

// ── Webhook signature ─────────────────────────────────────────────────────────

let publicKey: Promise<string> | null = null;

function fetchPublicKey(): Promise<string> {
  publicKey = fetch(`${API}/public-key`)
    .then((r) => r.json())
    .then((j: any) => j.data.public_key as string);
  publicKey.catch(() => (publicKey = null));
  return publicKey;
}

/** RSA-SHA256 (PKCS1v15) over `${messageId}.${timestamp}.${body}`, base64 signature. */
export async function verifyKickSignature(
  messageId: string,
  timestamp: string,
  body: string,
  signature: string
): Promise<boolean> {
  const check = (pem: string) =>
    createVerify("RSA-SHA256").update(`${messageId}.${timestamp}.${body}`).verify(pem, signature, "base64");
  if (check(await (publicKey ?? fetchPublicKey()))) return true;
  // Kick may rotate the key; retry once with a fresh one
  return check(await fetchPublicKey());
}

// ── Event mapping ─────────────────────────────────────────────────────────────

interface KickUser {
  user_id?: number;
  username: string;
  is_anonymous?: boolean;
  identity?: { username_color?: string; badges?: { type: string }[] } | null;
}

function name(u: KickUser | undefined): string {
  return !u || u.is_anonymous ? "Anonymous" : u.username;
}

export function mapKickEvent(
  type: string,
  id: string,
  p: any,
  botUserId = ""
): ChatMessage | PlatformEventMessage | null {
  if (type === "chat.message.sent") {
    const sender: KickUser = p.sender;
    return {
      id: p.message_id ?? id,
      platform: "kick",
      username: name(sender),
      displayName: name(sender),
      message: p.content,
      timestamp: Date.now(),
      userColor: sender.identity?.username_color ?? undefined,
      badges: sender.identity?.badges?.map((b) => b.type) ?? [],
      isSelf: !!botUserId && String(sender.user_id) === botUserId,
    };
  }

  const event = (kind: PlatformEventMessage["kind"], user: KickUser, extra = {}): PlatformEventMessage => ({
    id,
    type: "platform_event",
    platform: "kick",
    kind,
    username: name(user),
    displayName: name(user),
    timestamp: Date.now(),
    ...extra,
  });

  switch (type) {
    case "channel.followed":
      return event("follow", p.follower);
    case "channel.subscription.new":
    case "channel.subscription.renewal":
      return event("sub", p.subscriber, { giftCount: p.duration });
    case "channel.subscription.gifts":
      return event("gift_sub", p.gifter, { giftCount: p.giftees?.length ?? 1 });
    case "kicks.gifted":
      return event("gift", p.sender, { giftName: p.gift?.name, giftCount: 1, giftValue: p.gift?.amount });
    default:
      return null;
  }
}

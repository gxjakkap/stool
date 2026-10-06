/**
 * Shared domain types.
 * Derived from TypeBox models where applicable — single source of truth.
 */
import type { UnwrapSchema } from "elysia";
import type { TokenModel } from "./modules/token/model";

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  type?: "chat";
  platform: "twitch" | "youtube" | "tiktok" | "kick";
  username: string;
  displayName: string;
  message: string;
  timestamp: number;
  userColor?: string;
  badges?: string[];
}

export type PlatformEventKind = "gift" | "follow" | "share" | "sub" | "gift_sub";

export interface PlatformEventMessage {
  id: string;
  type: "platform_event";
  platform: "tiktok" | "kick";
  kind: PlatformEventKind;
  username: string;
  displayName: string;
  timestamp: number;
  /** gift: item count. sub: months. gift_sub: number of subs gifted. */
  giftCount?: number;
  giftName?: string;
  /** Per-item value: TikTok diamonds or Kick kicks */
  giftValue?: number;
  giftImageUrl?: string;
}

export interface DonationMessage {
  id: string;
  type: "donation";
  referenceNo: string;
  donatorName: string;
  channelName: string;
  donateMessage: string | null;
  amount: number;
  time: number; // unix timestamp ms
}

export interface SystemStatusMessage {
  type: "system_status";
  platform: "tiktok" | "twitch" | "youtube";
  status: "connected" | "disconnected" | "connecting";
}

/** Union of all messages that can be broadcast over WebSocket */
export type WsMessage = ChatMessage | PlatformEventMessage | DonationMessage | SystemStatusMessage;

// ── Emotes ────────────────────────────────────────────────────────────────────

export interface EmoteInfo {
  code: string;
  url: string;
}

// ── Token ─────────────────────────────────────────────────────────────────────

/** Derived from TokenModel — single source of truth */
export type OverlayToken = UnwrapSchema<(typeof TokenModel)["overlayToken"]>;

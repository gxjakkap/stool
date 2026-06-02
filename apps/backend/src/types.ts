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
  platform: "twitch" | "youtube" | "tiktok";
  username: string;
  displayName: string;
  message: string;
  timestamp: number;
  userColor?: string;
  badges?: string[];
}

export type TikTokEventKind = "gift" | "follow" | "share";

export interface TikTokEventMessage {
  id: string;
  type: "tiktok_event";
  platform: "tiktok";
  kind: TikTokEventKind;
  username: string;
  displayName: string;
  timestamp: number;
  /** Gift-specific fields */
  giftName?: string;
  giftCount?: number;
  giftDiamonds?: number;
  giftImageUrl?: string;
}

/** Union of all messages that can be broadcast over WebSocket */
export type WsMessage = ChatMessage | TikTokEventMessage;

// ── Emotes ────────────────────────────────────────────────────────────────────

export interface EmoteInfo {
  code: string;
  url: string;
}

// ── Token ─────────────────────────────────────────────────────────────────────

/** Derived from TokenModel — single source of truth */
export type OverlayToken = UnwrapSchema<(typeof TokenModel)["overlayToken"]>;

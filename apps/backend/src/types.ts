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

export interface EmoteInfo {
  code: string;
  url: string;
}

export interface OverlayToken {
  token: string;
  label: string;
  created_at: number;
}

export interface Settings {
  twitch_channel: string;
  twitch_client_id: string;
  twitch_client_secret: string;
  youtube_channel_id: string;
  youtube_api_key: string;
  tiktok_username: string;
  overlay_expire_seconds: string;
  overlay_max_messages: string;
  overlay_font_size: string;
  overlay_animation_speed: string;
  oidc_issuer: string;
  oidc_client_id: string;
  oidc_client_secret: string;
  oidc_redirect_uri: string;
  [key: string]: string;
}

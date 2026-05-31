export interface ChatMessage {
  id: string;
  platform: "twitch" | "youtube" | "tiktok";
  username: string;
  displayName: string;
  message: string;
  timestamp: number;
  userColor?: string;
  badges?: string[];
}

export interface OverlayToken {
  token: string;
  label: string;
  created_at: number;
}

export interface Settings {
  twitch_channel: string;
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

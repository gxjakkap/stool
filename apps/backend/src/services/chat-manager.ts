import type { WsMessage } from "../types";

type MessageHandler = (msg: WsMessage) => void;


class ChatManager {
  private handlers: Set<MessageHandler> = new Set();
  private twitchConnector: import("../connectors/twitch").TwitchConnector | null = null;
  private youtubeConnector: import("../connectors/youtube").YouTubeConnector | null = null;
  private tiktokConnector: import("../connectors/tiktok").TikTokConnector | null = null;
  private tiktokStatus: "connected" | "disconnected" | "connecting" = "disconnected";

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  broadcast(msg: WsMessage): void {
    for (const handler of this.handlers) {
      try {
        handler(msg);
      } catch (e) {
        console.error("[ChatManager] Handler error:", e);
      }
    }
  }

  getTikTokStatus() {
    return this.tiktokStatus;
  }

  async startTwitch(channel: string): Promise<void> {
    if (!channel) return;
    const { TwitchConnector } = await import("../connectors/twitch");
    this.twitchConnector?.stop();
    this.twitchConnector = new TwitchConnector(channel, (msg) => this.broadcast(msg));
    await this.twitchConnector.start();
  }

  async startYouTube(channelId: string, apiKey: string): Promise<void> {
    if (!channelId || !apiKey) return;
    const { YouTubeConnector } = await import("../connectors/youtube");
    this.youtubeConnector?.stop();
    this.youtubeConnector = new YouTubeConnector(channelId, apiKey, (msg) => this.broadcast(msg));
    await this.youtubeConnector.start();
  }

  async startTikTok(username: string, sessionId?: string): Promise<void> {
    if (!username) return;
    const { TikTokConnector } = await import("../connectors/tiktok");
    this.tiktokConnector?.stop();
    this.tiktokStatus = "connecting";
    this.broadcast({ type: "system_status", platform: "tiktok", status: "connecting" });
    this.tiktokConnector = new TikTokConnector(
      username, 
      sessionId, 
      (msg) => this.broadcast(msg),
      (status) => {
        this.tiktokStatus = status;
        this.broadcast({ type: "system_status", platform: "tiktok", status });
      }
    );
    await this.tiktokConnector.start();
  }

  async restartTikTokFromSettings(): Promise<void> {
    const { getSetting } = await import("../db/client");
    const tiktokUsername = getSetting("tiktok_username") ?? "";
    const tiktokSessionId = getSetting("tiktok_session_id") ?? undefined;
    try {
      await this.startTikTok(tiktokUsername, tiktokSessionId);
    } catch (e) {
      console.error("[ChatManager] Failed to start TikTok connector:", e);
    }
  }

  stopAll(): void {
    this.twitchConnector?.stop();
    this.youtubeConnector?.stop();
    this.tiktokConnector?.stop();
    this.twitchConnector = null;
    this.youtubeConnector = null;
    this.tiktokConnector = null;
  }

  async restartFromSettings(): Promise<void> {
    this.stopAll();
    const { getSetting } = await import("../db/client");
    const twitchChannel = getSetting("twitch_channel") ?? "";
    const youtubeChannelId = getSetting("youtube_channel_id") ?? "";
    const youtubeApiKey = getSetting("youtube_api_key") ?? "";
    const tiktokUsername = getSetting("tiktok_username") ?? "";
    const tiktokSessionId = getSetting("tiktok_session_id") ?? undefined;

    const results = await Promise.allSettled([
      this.startTwitch(twitchChannel),
      this.startYouTube(youtubeChannelId, youtubeApiKey),
      this.startTikTok(tiktokUsername, tiktokSessionId),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const platforms = ["Twitch", "YouTube", "TikTok"];
        console.error(`[ChatManager] Failed to start ${platforms[index]} connector:`, result.reason);
      }
    });
  }
}

export const chatManager = new ChatManager();

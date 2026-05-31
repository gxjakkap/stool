import type { ChatMessage } from "../types";

type MessageHandler = (msg: ChatMessage) => void;

class ChatManager {
  private handlers: Set<MessageHandler> = new Set();
  private twitchConnector: import("../connectors/twitch").TwitchConnector | null = null;
  private youtubeConnector: import("../connectors/youtube").YouTubeConnector | null = null;
  private tiktokConnector: import("../connectors/tiktok").TikTokConnector | null = null;

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  broadcast(msg: ChatMessage): void {
    for (const handler of this.handlers) {
      try {
        handler(msg);
      } catch (e) {
        console.error("[ChatManager] Handler error:", e);
      }
    }
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

  async startTikTok(username: string): Promise<void> {
    if (!username) return;
    const { TikTokConnector } = await import("../connectors/tiktok");
    this.tiktokConnector?.stop();
    this.tiktokConnector = new TikTokConnector(username, (msg) => this.broadcast(msg));
    await this.tiktokConnector.start();
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

    await Promise.allSettled([
      this.startTwitch(twitchChannel),
      this.startYouTube(youtubeChannelId, youtubeApiKey),
      this.startTikTok(tiktokUsername),
    ]);
  }
}

export const chatManager = new ChatManager();

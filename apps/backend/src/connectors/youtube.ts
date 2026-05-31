import { google } from "googleapis";
import { nanoid } from "nanoid";
import type { ChatMessage } from "../types";

export class YouTubeConnector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private liveChatId: string | null = null;
  private nextPageToken: string | undefined = undefined;
  private youtube: ReturnType<typeof google.youtube>;

  constructor(
    private channelId: string,
    private apiKey: string,
    private onMessage: (msg: ChatMessage) => void
  ) {
    this.youtube = google.youtube({ version: "v3", auth: this.apiKey });
  }

  async start(): Promise<void> {
    try {
      // Find active live stream
      const searchRes = await this.youtube.search.list({
        part: ["id"],
        channelId: this.channelId,
        eventType: "live",
        type: ["video"],
      });

      const videoId = searchRes.data.items?.[0]?.id?.videoId;
      if (!videoId) {
        console.log(`[YouTube] No active live stream found for channel ${this.channelId}`);
        return;
      }

      // Get live chat ID
      const videoRes = await this.youtube.videos.list({
        part: ["liveStreamingDetails"],
        id: [videoId],
      });

      this.liveChatId = videoRes.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
      if (!this.liveChatId) {
        console.log(`[YouTube] No active live chat for video ${videoId}`);
        return;
      }

      console.log(`[YouTube] Connected to live chat for video ${videoId}`);
      this.poll();
    } catch (e) {
      console.error("[YouTube] Failed to start:", e);
    }
  }

  private poll(): void {
    this.intervalId = setInterval(async () => {
      if (!this.liveChatId) return;
      try {
        const res = await this.youtube.liveChatMessages.list({
          liveChatId: this.liveChatId,
          part: ["snippet", "authorDetails"],
          pageToken: this.nextPageToken,
        });

        this.nextPageToken = res.data.nextPageToken ?? undefined;
        const pollingMs = res.data.pollingIntervalMillis ?? 5000;

        // Reschedule with the interval provided by API
        clearInterval(this.intervalId!);
        if (this.liveChatId) {
          this.intervalId = setInterval(() => this.poll(), pollingMs);
        }

        for (const item of res.data.items ?? []) {
          const snippet = item.snippet;
          const author = item.authorDetails;
          if (snippet?.type !== "textMessageEvent") continue;

          this.onMessage({
            id: item.id ?? nanoid(),
            platform: "youtube",
            username: author?.channelId ?? "unknown",
            displayName: author?.displayName ?? "Unknown",
            message: snippet.textMessageDetails?.messageText ?? "",
            timestamp: new Date(snippet.publishedAt ?? Date.now()).getTime(),
          });
        }
      } catch (e) {
        console.error("[YouTube] Polling error:", e);
      }
    }, 5000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.liveChatId = null;
    console.log("[YouTube] Disconnected");
  }
}

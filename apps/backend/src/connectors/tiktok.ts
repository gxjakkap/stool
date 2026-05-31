import { WebcastPushConnection } from "tiktok-live-connector";
import { nanoid } from "nanoid";
import type { ChatMessage } from "../types";

export class TikTokConnector {
  private connection: WebcastPushConnection | null = null;

  constructor(
    private username: string,
    private onMessage: (msg: ChatMessage) => void
  ) {}

  async start(): Promise<void> {
    try {
      this.connection = new WebcastPushConnection(this.username);

      this.connection.on("chat", (data: any) => {
        this.onMessage({
          id: data.msgId?.toString() ?? nanoid(),
          platform: "tiktok",
          username: data.uniqueId ?? "unknown",
          displayName: data.nickname ?? data.uniqueId ?? "Unknown",
          message: data.comment ?? "",
          timestamp: Date.now(),
        });
      });

      this.connection.on("error", (err: any) => {
        console.error("[TikTok] Error:", err);
      });

      await this.connection.connect();
      console.log(`[TikTok] Connected to @${this.username}`);
    } catch (e) {
      console.error(`[TikTok] Failed to connect to @${this.username}:`, e);
    }
  }

  stop(): void {
    this.connection?.disconnect();
    this.connection = null;
    console.log("[TikTok] Disconnected");
  }
}

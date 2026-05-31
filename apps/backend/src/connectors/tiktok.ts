import { WebcastPushConnection } from "tiktok-live-connector";
import { nanoid } from "nanoid";
import type { ChatMessage } from "../types";

export class TikTokConnector {
  private connection: WebcastPushConnection | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private isStopped = false;

  constructor(
    private username: string,
    private onMessage: (msg: ChatMessage) => void
  ) {}

  async start(): Promise<void> {
    this.isStopped = false;
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.isStopped) return;
    
    try {
      const normalizedUsername = this.username.startsWith("@")
        ? this.username.slice(1)
        : this.username;
      this.connection = new WebcastPushConnection(normalizedUsername);

      this.connection.on("chat", (data: any) => {
        console.log(`[TikTok] New chat from ${data.uniqueId}: ${data.comment}`);
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
      
      this.connection.on("disconnected", () => {
        console.log("[TikTok] Disconnected, retrying in 30s...");
        this.scheduleRetry();
      });

      await this.connection.connect();
      console.log(`[TikTok] Connected to @${normalizedUsername}`);
    } catch (e: any) {
      const normalizedUsername = this.username.startsWith("@")
        ? this.username.slice(1)
        : this.username;
      console.error(`[TikTok] Failed to connect to @${normalizedUsername}:`, e.message || e);
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    if (this.isStopped) return;
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.retryTimeout = setTimeout(() => {
      this.connect();
    }, 30000);
  }

  stop(): void {
    this.isStopped = true;
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.connection?.disconnect();
    this.connection = null;
    console.log("[TikTok] Stopped connector");
  }
}

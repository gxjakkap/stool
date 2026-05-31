import { TikTokLiveConnection } from "tiktok-live-connector";
import { nanoid } from "nanoid";
import type { ChatMessage } from "../types";

export class TikTokConnector {
  private connection: TikTokLiveConnection | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private isStopped = false;

  constructor(
    private username: string,
    private sessionId: string | undefined,
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
      this.connection = new TikTokLiveConnection(normalizedUsername, { 
        processInitialData: false,
        ...(this.sessionId ? { sessionId: this.sessionId } : {})
      });

      this.connection.on("chat", (data: any) => {
        const uniqueId = data.user?.displayId ?? "unknown";
        const nickname = data.user?.nickname ?? uniqueId;
        const msgText = data.content ?? "";
        
        console.log(`[TikTok] New chat from ${uniqueId}: ${msgText}`);
        
        this.onMessage({
          id: data.common?.msgId?.toString() ?? nanoid(),
          platform: "tiktok",
          username: uniqueId,
          displayName: nickname,
          message: msgText,
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

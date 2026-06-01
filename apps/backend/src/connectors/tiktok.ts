import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";
import { nanoid } from "nanoid";
import type { ChatMessage, TikTokEventMessage } from "../types";

export class TikTokConnector {
  private connection: TikTokLiveConnection | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private isStopped = false;

  constructor(
    private username: string,
    private sessionId: string | undefined,
    private onMessage: (msg: ChatMessage | TikTokEventMessage) => void
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
        enableExtendedGiftInfo: true,
        ...(this.sessionId ? { sessionId: this.sessionId } : {})
      });

      this.connection.on(WebcastEvent.CHAT, (data: any) => {
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

      this.connection.on(WebcastEvent.GIFT, (data: any) => {
        // Only fire on streak end (repeatEnd=1) or non-streakable gifts (repeatEnd undefined)
        if (data.repeatEnd === 0) return;
        const uniqueId = data.user?.displayId ?? data.user?.uniqueId ?? "unknown";
        const nickname = data.user?.nickname ?? uniqueId;
        const extended = data.extendedGiftInfo;
        const giftName = extended?.name ?? `Gift #${data.giftId ?? "?"}`;
        const giftCount = data.repeatCount ?? 1;
        const giftDiamonds = extended?.diamondCount;
        const giftImageUrl = extended?.image?.urlList?.[0] ?? extended?.imageUrl;

        console.log(`[TikTok] Gift from ${uniqueId}: ${giftName} x${giftCount}`);

        const event: TikTokEventMessage = {
          id: data.common?.msgId?.toString() ?? nanoid(),
          type: "tiktok_event",
          platform: "tiktok",
          kind: "gift",
          username: uniqueId,
          displayName: nickname,
          timestamp: Date.now(),
          giftName,
          giftCount,
          giftDiamonds,
          giftImageUrl,
        };
        this.onMessage(event);
      });

      this.connection.on(WebcastEvent.FOLLOW, (data: any) => {
        const uniqueId = data.user?.displayId ?? data.user?.uniqueId ?? "unknown";
        const nickname = data.user?.nickname ?? uniqueId;
        console.log(`[TikTok] Follow from ${uniqueId}`);

        const event: TikTokEventMessage = {
          id: data.common?.msgId?.toString() ?? nanoid(),
          type: "tiktok_event",
          platform: "tiktok",
          kind: "follow",
          username: uniqueId,
          displayName: nickname,
          timestamp: Date.now(),
        };
        this.onMessage(event);
      });

      this.connection.on(WebcastEvent.SHARE, (data: any) => {
        const uniqueId = data.user?.displayId ?? data.user?.uniqueId ?? "unknown";
        const nickname = data.user?.nickname ?? uniqueId;
        console.log(`[TikTok] Share from ${uniqueId}`);

        const event: TikTokEventMessage = {
          id: data.common?.msgId?.toString() ?? nanoid(),
          type: "tiktok_event",
          platform: "tiktok",
          kind: "share",
          username: uniqueId,
          displayName: nickname,
          timestamp: Date.now(),
        };
        this.onMessage(event);
      });

      this.connection.on(ControlEvent.ERROR, (err: any) => {
        console.error("[TikTok] Error:", err);
      });
      
      this.connection.on(ControlEvent.DISCONNECTED, () => {
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

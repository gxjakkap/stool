import tmi from "tmi.js";
import { nanoid } from "nanoid";
import type { ChatMessage } from "../types";

export class TwitchConnector {
  private client: tmi.Client | null = null;

  constructor(
    private channel: string,
    private onMessage: (msg: ChatMessage) => void
  ) {}

  async start(): Promise<void> {
    this.client = new tmi.Client({
      channels: [this.channel],
      options: { debug: false },
    });

    this.client.on("message", (_channel, tags, message, _self) => {
      this.onMessage({
        id: tags.id ?? nanoid(),
        platform: "twitch",
        username: tags.username ?? "anonymous",
        displayName: tags["display-name"] ?? tags.username ?? "anonymous",
        message,
        timestamp: Date.now(),
        userColor: tags.color ?? undefined,
        badges: Object.keys(tags.badges ?? {}),
      });
    });

    try {
      await this.client.connect();
      console.log(`[Twitch] Connected to #${this.channel}`);
    } catch (e) {
      console.error(`[Twitch] Failed to connect to #${this.channel}:`, e);
    }
  }

  stop(): void {
    this.client?.disconnect().catch(() => {});
    this.client = null;
  }
}

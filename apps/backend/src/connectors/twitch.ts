import tmi from "tmi.js";
import { nanoid } from "nanoid";
import type { ChatMessage } from "../types";

export class TwitchConnector {
  private client: tmi.Client | null = null;

  /** With `bot`, connects as that account so say() works; otherwise reads anonymously. */
  constructor(
    private channel: string,
    private onMessage: (msg: ChatMessage) => void,
    private bot?: { login: string; getToken: () => Promise<string> }
  ) {}

  async start(): Promise<void> {
    const bot = this.bot;
    this.client = new tmi.Client({
      channels: [this.channel],
      options: { debug: false },
      // tmi calls the password function on every (re)connect, so refreshed tokens are picked up
      identity: bot ? { username: bot.login, password: async () => `oauth:${await bot.getToken()}` } : undefined,
    });

    this.client.on("message", (_channel, tags, message, self) => {
      this.onMessage({
        id: tags.id ?? nanoid(),
        platform: "twitch",
        username: tags.username ?? "anonymous",
        displayName: tags["display-name"] ?? tags.username ?? "anonymous",
        message,
        timestamp: Date.now(),
        userColor: tags.color ?? undefined,
        badges: Object.keys(tags.badges ?? {}),
        isSelf: self || (!!bot && tags.username === bot.login.toLowerCase()),
      });
    });

    try {
      await this.client.connect();
      console.log(`[Twitch] Connected to #${this.channel}${bot ? ` as ${bot.login}` : ""}`);
    } catch (e) {
      console.error(`[Twitch] Failed to connect to #${this.channel}:`, e);
    }
  }

  async say(text: string): Promise<void> {
    if (!this.client || !this.bot) throw new Error("twitch bot account not connected");
    await this.client.say(this.channel, text);
  }

  stop(): void {
    this.client?.disconnect().catch(() => {});
    this.client = null;
  }
}

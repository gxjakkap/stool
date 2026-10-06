import type { ChatMessage } from "../types";
import { getSetting, listTimers, setSetting } from "../db/client";
import { renderTemplate } from "./macro";
import { accountInfo, PLATFORMS, type Platform } from "./oauth";
import { getStreamInfo, pinTwitchChat, sendKickChat, type StreamInfo } from "./platform-api";
import { chatManager } from "./chat-manager";
import { MAX_OUTPUT } from "./bot";

// In memory on purpose: a restart just restarts every timer's interval
const lines: Record<Platform, number> = { twitch: 0, kick: 0 };
const fired = new Map<string, { at: number; lines: number }>();

export function startTimers(): void {
  chatManager.subscribe((msg) => {
    if (msg.type !== undefined && msg.type !== "chat") return;
    const chat = msg as ChatMessage;
    if (!chat.isSelf && chat.platform in lines) lines[chat.platform as Platform]++;
  });
  setInterval(() => tick().catch((e) => console.error("[Timers] Tick failed:", e)), 30_000);
}

async function tick(): Promise<void> {
  const timers = listTimers().filter((t) => t.enabled);
  const pinned = getSetting("pinned_message")?.trim();
  if (!timers.length && !pinned) return;

  const infos = Object.fromEntries(
    await Promise.all(
      PLATFORMS.map(async (p) => [p, accountInfo(p, "bot") ? await getStreamInfo(p).catch(() => null) : null] as const)
    )
  ) as Record<Platform, StreamInfo | null>;
  const live = Object.fromEntries(PLATFORMS.map((p) => [p, !!infos[p]?.live])) as Record<Platform, boolean>;

  if (pinned) for (const p of PLATFORMS) postPinned(p, infos[p], pinned);

  const now = Date.now();
  for (const t of timers) {
    for (const p of t.platforms.split(",") as Platform[]) {
      const key = `${t.id}:${p}`;
      if (!live[p]) {
        fired.delete(key);
        continue;
      }
      const last = fired.get(key);
      // First tick while live starts the clock instead of firing immediately
      if (!last) {
        fired.set(key, { at: now, lines: lines[p] });
        continue;
      }
      if (now - last.at < t.interval_minutes * 60_000 || lines[p] - last.lines < t.min_lines) continue;
      fired.set(key, { at: now, lines: lines[p] });
      renderTemplate(t.message, { user: "", args: [], query: "", platform: p })
        .then((text) => {
          if (text.trim()) return chatManager.say(p, text.slice(0, MAX_OUTPUT));
        })
        .catch((e) => console.error(`[Timers] Timer ${t.id} on ${p} failed:`, e));
    }
  }
}

/** Once per stream: the stream start time is stored so a backend restart mid-stream does not repost. */
function postPinned(p: Platform, info: StreamInfo | null, template: string): void {
  if (!info?.live || !Number.isFinite(info.startedAt)) return;
  const key = `pinned_message_${p}_stream`;
  if (getSetting(key) === String(info.startedAt)) return;
  // Marked before sending so a failing pin is not retried every tick
  setSetting(key, String(info.startedAt));
  renderTemplate(template, { user: "", args: [], query: "", platform: p })
    .then((text) => {
      text = text.trim().slice(0, MAX_OUTPUT);
      if (!text) return;
      // Kick's public API has no pin endpoint, so Kick only gets the message
      return p === "twitch" ? pinTwitchChat(text) : sendKickChat(text);
    })
    .catch((e) => console.error(`[Timers] Pinned message on ${p} failed:`, e));
}

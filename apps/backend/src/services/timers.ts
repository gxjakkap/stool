import type { ChatMessage } from "../types";
import { listTimers } from "../db/client";
import { renderTemplate } from "./macro";
import { accountInfo, PLATFORMS, type Platform } from "./oauth";
import { getStreamInfo } from "./platform-api";
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
  if (!timers.length) return;

  const live = Object.fromEntries(
    await Promise.all(
      PLATFORMS.map(async (p) => [p, !!accountInfo(p, "bot") && !!(await getStreamInfo(p).catch(() => null))?.live] as const)
    )
  ) as Record<Platform, boolean>;

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

import type { ChatMessage, WsMessage } from "../types";
import { addCommand, deleteCommand, editCommand, getCommand } from "../db/client";
import { renderTemplate } from "./macro";
import { accountInfo, PLATFORMS, type Platform } from "./oauth";
import { getStreamInfo, setCategory, setTitle } from "./platform-api";
import { chatManager } from "./chat-manager";

export const RESERVED = ["!addcom", "!editcom", "!delcom", "!commands", "!title", "!game", "!uptime"];
export const MAX_OUTPUT = 400;
export const MAX_TRIGGER = 50;
export const MAX_RESPONSE = 2000;

const NAMES: Record<Platform, string> = { twitch: "Twitch", kick: "Kick" };

export function parseMessage(message: string) {
  const trimmed = message.trim();
  const space = trimmed.search(/\s/);
  const trigger = (space < 0 ? trimmed : trimmed.slice(0, space)).toLowerCase();
  const query = space < 0 ? "" : trimmed.slice(space).trim();
  return { trigger, query, args: query ? query.split(/\s+/) : [] };
}

export const isMod = (msg: ChatMessage) => !!msg.badges?.some((b) => b === "broadcaster" || b === "moderator");

/** Pulls a leading -prefix / -noprefix flag off the args. */
function takeFlag(args: string[]): boolean | undefined {
  if (args[0] === "-noprefix") return args.shift(), false;
  if (args[0] === "-prefix") return args.shift(), true;
  return undefined;
}

/** Validates a trigger for creation; returns an error message or null. */
export function triggerError(trigger: string): string | null {
  if (!trigger || /\s/.test(trigger)) return "trigger must be a single word";
  if (trigger.length > MAX_TRIGGER) return `trigger must be at most ${MAX_TRIGGER} characters`;
  if (RESERVED.includes(trigger.toLowerCase())) return `${trigger} is reserved`;
  return null;
}

/** Computes the bot's reply to a chat message, or null for no reply. */
export async function handleMessage(msg: ChatMessage): Promise<string | null> {
  if (msg.isSelf || (msg.platform !== "twitch" && msg.platform !== "kick")) return null;
  const { trigger, query, args } = parseMessage(msg.message);
  const at = (text: string) => `@${msg.displayName} ${text}`;
  const mod = isMod(msg);
  const denied = at("you don't have permission to use this command");

  switch (trigger) {
    case "!addcom":
    case "!editcom": {
      if (!mod) return denied;
      const prefix = takeFlag(args);
      const name = args.shift() ?? "";
      const response = args.join(" ");
      const usage = at(`usage: ${trigger} [-noprefix] <command> <response>`);
      if (!name || !response) return usage;
      if (response.length > MAX_RESPONSE) return at(`response must be at most ${MAX_RESPONSE} characters`);
      if (trigger === "!editcom") {
        return editCommand(name, response, prefix) ? at(`command "${name}" has been updated`) : at(`command "${name}" does not exist!`);
      }
      const err = triggerError(name);
      if (err) return at(err);
      return addCommand(name, response, prefix ?? true, msg.displayName)
        ? at(`command "${name}" has been added`)
        : at(`command "${name}" already exists!`);
    }
    case "!delcom": {
      if (!mod) return denied;
      if (!args[0]) return at("usage: !delcom <command>");
      return deleteCommand(args[0]) ? at(`command "${args[0]}" has been deleted`) : at(`command "${args[0]}" does not exist!`);
    }
    case "!commands":
      return at(`here's the list of commands: ${process.env.FRONTEND_ORIGIN ?? "http://localhost:3000"}/commands/public`);
    case "!title":
      if (!query) return at(`current title: ${(await getStreamInfo(msg.platform, 0))?.title ?? "unknown"}`);
      if (!mod) return denied;
      return at(await updateAll("Title updated", "Title not changed", (p) => setTitle(p, query)));
    case "!game":
      if (!query) return at(`current game: ${(await getStreamInfo(msg.platform, 0))?.category || "none"}`);
      if (!mod) return denied;
      return at(await updateAll("Game set to", "Game not changed", (p) => setCategory(p, query)));
    case "!uptime":
      return at(await uptime());
  }

  const cmd = getCommand(trigger);
  if (!cmd) return null;
  try {
    const out = (await renderTemplate(cmd.response, { user: msg.displayName, args, query, platform: msg.platform })).slice(0, MAX_OUTPUT);
    if (!out.trim()) return null;
    return cmd.prefix_user ? at(out) : out;
  } catch (e) {
    console.error(`[Bot] Command ${trigger} failed:`, e);
    return at("command failed");
  }
}

/** Runs an update on every platform with a connected broadcaster account and summarizes it. */
async function updateAll(okText: string, failText: string, run: (p: Platform) => Promise<string | void>): Promise<string> {
  const targets = PLATFORMS.filter((p) => accountInfo(p, "broadcaster"));
  if (!targets.length) return "no broadcaster account connected";
  const results = await Promise.allSettled(targets.map(run));
  const names = new Set<string>();
  const failures: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value) names.add(r.value);
      return;
    }
    const reason = r.reason instanceof Error && r.reason.message === "not found" ? "not found" : "failed";
    if (reason === "failed") console.error(`[Bot] ${NAMES[targets[i]]} update failed:`, r.reason);
    failures.push(`${NAMES[targets[i]]}: ${reason}`);
  });
  let text = failures.length === targets.length ? failText : [okText, [...names].join(" / ")].filter(Boolean).join(" ");
  if (failures.length) text += ` (${failures.join(", ")})`;
  return text;
}

async function uptime(): Promise<string> {
  const infos = await Promise.all(PLATFORMS.map((p) => getStreamInfo(p).catch(() => null)));
  const starts = infos.flatMap((i) => (i?.live && i.startedAt ? [i.startedAt] : []));
  if (!starts.length) return "stream is offline";
  return `live for ${formatDuration(Date.now() - Math.min(...starts))}`;
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 60_000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  return h ? `${part(h, "hour")} ${part(m, "minute")}` : part(m, "minute");
}

export function startBot(): void {
  chatManager.subscribe((msg: WsMessage) => {
    if (msg.type !== undefined && msg.type !== "chat") return;
    const chat = msg as ChatMessage;
    handleMessage(chat)
      .then((reply) => {
        if (reply) return chatManager.say(chat.platform as Platform, reply);
      })
      .catch((e) => console.error("[Bot] Reply failed:", e));
  });
}

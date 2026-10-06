import { expect, test } from "bun:test";
import type { ChatMessage } from "../types";

process.env.DB_PATH = ":memory:";
const { migrate } = await import("../db/schema");
const { handleMessage, parseMessage, formatDuration } = await import("./bot");
migrate();

const chat = (message: string, badges: string[] = [], extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "1",
  platform: "twitch",
  username: "viewer",
  displayName: "Viewer",
  message,
  timestamp: 0,
  badges,
  ...extra,
});
const mod = (message: string) => chat(message, ["moderator"]);

test("parseMessage lowercases the trigger and splits args", () => {
  expect(parseMessage("  !Hug  a   b ")).toEqual({ trigger: "!hug", query: "a   b", args: ["a", "b"] });
  expect(parseMessage("นน")).toEqual({ trigger: "นน", query: "", args: [] });
});

test("command management is mod-only and validates input", async () => {
  expect(await handleMessage(chat("!addcom !x hi"))).toContain("don't have permission");
  expect(await handleMessage(mod("!addcom !x"))).toContain("usage");
  expect(await handleMessage(mod("!addcom !title nope"))).toContain("reserved");
  expect(await handleMessage(chat("!addcom !x hi", ["broadcaster"]))).toContain("has been added");
  expect(await handleMessage(mod("!addcom !X again"))).toContain("already exists");
  expect(await handleMessage(chat("!x"))).toBe("@Viewer hi");
  expect(await handleMessage(chat("!X"))).toBe("@Viewer hi");
});

test("-noprefix, macros, edit and delete", async () => {
  await handleMessage(mod("!addcom -noprefix 555 ${user} laughs at ${args[0] ?? 'nothing'}"));
  expect(await handleMessage(chat("555 you"))).toBe("Viewer laughs at you");
  expect(await handleMessage(mod("!editcom 555 lol"))).toContain("updated");
  expect(await handleMessage(chat("555"))).toBe("lol");
  expect(await handleMessage(mod("!editcom -prefix 555 lol"))).toContain("updated");
  expect(await handleMessage(chat("555"))).toBe("@Viewer lol");
  expect(await handleMessage(mod("!editcom !missing x"))).toContain("does not exist");
  expect(await handleMessage(mod("!delcom 555"))).toContain("deleted");
  expect(await handleMessage(chat("555"))).toBeNull();
});

test("broken macros fail softly; self and unsupported platforms are ignored", async () => {
  await handleMessage(mod("!addcom !bad ${nope()}"));
  expect(await handleMessage(chat("!bad"))).toBe("@Viewer command failed");
  expect(await handleMessage(chat("!bad", [], { isSelf: true }))).toBeNull();
  expect(await handleMessage(chat("!bad", [], { platform: "youtube" }))).toBeNull();
  expect(await handleMessage(chat("hello there"))).toBeNull();
});

test("formatDuration", () => {
  expect(formatDuration(61 * 60_000)).toBe("1 hour 1 minute");
  expect(formatDuration(5 * 60_000)).toBe("5 minutes");
});

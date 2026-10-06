import { expect, test } from "bun:test";
import { isBlockedAddress, parseTemplate, renderTemplate, safeFetch } from "./macro";

const ctx = { user: "jakka", args: ["a", "b"], query: "a b", platform: "twitch" };

test("parseTemplate splits text and code, respecting strings and nesting", () => {
  expect(parseTemplate("hi ${user}!")).toEqual([{ text: "hi " }, { code: "user" }, { text: "!" }]);
  expect(parseTemplate("${ {a:'}'}.a }")).toEqual([{ code: " {a:'}'}.a " }]);
  expect(parseTemplate("${`x${1+1}}`}")).toEqual([{ code: "`x${1+1}}`" }]);
  expect(parseTemplate("cost \\${5}")).toEqual([{ text: "cost ${5}" }]);
  expect(() => parseTemplate("oops ${user")).toThrow();
});

test("renderTemplate evaluates segments with context", async () => {
  expect(await renderTemplate("plain", ctx)).toBe("plain");
  expect(await renderTemplate("${user} hugs ${args[1]} ${undefined}${1+1} // x", ctx)).toBe("jakka hugs b 2 // x");
  expect(await renderTemplate("${(async () => { const x = 2; return x * 3 })()}", ctx)).toBe("6");
  expect(await renderTemplate("${1 // trailing comment\n}", ctx)).toBe("1");
});

test("renderTemplate has no host access and enforces the deadline", async () => {
  expect(await renderTemplate("${typeof process}${typeof require}${typeof Bun}", ctx)).toBe("undefinedundefinedundefined");
  await expect(renderTemplate("${(() => { while (true) {} })()}", ctx)).rejects.toThrow();
  await expect(renderTemplate("${(() => { throw new Error('boom') })()}", ctx)).rejects.toThrow("boom");
}, 10_000);

test("fetch blocks private and local addresses", async () => {
  expect(isBlockedAddress("127.0.0.1")).toBe(true);
  expect(isBlockedAddress("10.0.0.1")).toBe(true);
  expect(isBlockedAddress("169.254.169.254")).toBe(true);
  expect(isBlockedAddress("::1")).toBe(true);
  expect(isBlockedAddress("::ffff:192.168.1.1")).toBe(true);
  expect(isBlockedAddress("8.8.8.8")).toBe(false);
  await expect(safeFetch("http://localhost:4000/api/settings")).rejects.toThrow("not allowed");
  await expect(safeFetch("file:///etc/passwd")).rejects.toThrow();
  await expect(renderTemplate("${fetch('http://127.0.0.1/').then(r => r.status)}", ctx)).rejects.toThrow("not allowed");
});

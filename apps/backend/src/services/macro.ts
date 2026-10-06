import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSDeferredPromise } from "quickjs-emscripten";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const DEADLINE_MS = 5000;
const MAX_BODY = 1 << 20;
const MAX_REDIRECTS = 3;

export interface MacroContext {
  user: string;
  args: string[];
  query: string;
  platform: string;
}

type Part = { text: string } | { code: string };

/**
 * Splits a response into literal text and `${ expr }` segments.
 * Brace matching skips string and template literals; `\${` is a literal `${`.
 */
export function parseTemplate(src: string): Part[] {
  const parts: Part[] = [];
  let text = "";
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("\\${", i)) {
      text += "${";
      i += 3;
    } else if (src.startsWith("${", i)) {
      const end = matchBrace(src, i + 2);
      if (end < 0) throw new Error("unterminated ${ segment");
      if (text) parts.push({ text });
      text = "";
      parts.push({ code: src.slice(i + 2, end) });
      i = end + 1;
    } else {
      text += src[i++];
    }
  }
  if (text) parts.push({ text });
  return parts;
}

/** Returns the index of the `}` closing a block that starts at `i`, or -1. */
function matchBrace(src: string, i: number): number {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") {
      i = skipString(src, i, c);
    } else if (c === "`") {
      i = skipTemplate(src, i);
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      if (depth === 0) return i;
      depth--;
    }
    if (i < 0) return -1;
    i++;
  }
  return -1;
}

function skipString(src: string, i: number, quote: string): number {
  for (i++; i < src.length; i++) {
    if (src[i] === "\\") i++;
    else if (src[i] === quote) return i;
  }
  return -1;
}

function skipTemplate(src: string, i: number): number {
  for (i++; i < src.length; i++) {
    if (src[i] === "\\") i++;
    else if (src[i] === "`") return i;
    else if (src.startsWith("${", i)) {
      i = matchBrace(src, i + 2);
      if (i < 0) return -1;
    }
  }
  return -1;
}

/** Renders a response. Plain text skips the sandbox entirely. */
export async function renderTemplate(src: string, ctx: MacroContext): Promise<string> {
  const parts = parseTemplate(src);
  const codes = parts.flatMap((p) => ("code" in p ? [p.code] : []));
  if (!codes.length) return parts.map((p) => ("text" in p ? p.text : "")).join("");

  const values = await runInSandbox(codes, ctx);
  let n = 0;
  return parts.map((p) => ("text" in p ? p.text : values[n++])).join("");
}

const PRELUDE = `
globalThis.fetch = async (url, init) => {
  const r = JSON.parse(await __hostFetch(String(url), JSON.stringify(init ?? {})));
  if (r.error) throw new Error(r.error);
  return { ok: r.ok, status: r.status, text: async () => r.body, json: async () => JSON.parse(r.body) };
};
`;

async function runInSandbox(codes: string[], ctx: MacroContext): Promise<string[]> {
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(16 << 20);
  runtime.setMaxStackSize(512 << 10);
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + DEADLINE_MS));
  const vm = runtime.newContext();
  const pending = new Set<QuickJSDeferredPromise>();
  let disposed = false;

  try {
    const hostFetch = vm.newFunction("__hostFetch", (urlHandle, initHandle) => {
      const url = vm.getString(urlHandle);
      const init = vm.getString(initHandle);
      const deferred = vm.newPromise();
      pending.add(deferred);
      safeFetch(url, JSON.parse(init))
        .catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))
        .then((result) => {
          if (disposed) return;
          const h = vm.newString(JSON.stringify(result));
          deferred.resolve(h);
          h.dispose();
          pending.delete(deferred);
          deferred.dispose();
          runtime.executePendingJobs();
        });
      return deferred.handle;
    });
    vm.setProp(vm.global, "__hostFetch", hostFetch);
    hostFetch.dispose();

    const globals = `const user = ${JSON.stringify(ctx.user)}, args = ${JSON.stringify(ctx.args)}, query = ${JSON.stringify(ctx.query)}, platform = ${JSON.stringify(ctx.platform)};\n`;
    // Each segment is wrapped on its own lines so a trailing // comment cannot swallow the rest
    const body = codes.map((c) => `__out.push(__str(await (\n${c}\n)));`).join("\n");
    const program = `${PRELUDE}${globals}(async () => { const __str = (v) => v == null ? "" : String(v); const __out = [];\n${body}\nreturn __out; })()`;

    const promise = vm.unwrapResult(vm.evalCode(program));
    const settled = vm.resolvePromise(promise);
    promise.dispose();
    runtime.executePendingJobs();

    const result = await Promise.race([
      settled,
      new Promise<null>((r) => setTimeout(() => r(null), DEADLINE_MS)),
    ]);
    if (!result) throw new Error("timed out");
    if (result.error) {
      const err = vm.dump(result.error);
      result.error.dispose();
      throw new Error(typeof err === "object" && err?.message ? `${err.name}: ${err.message}` : String(err));
    }
    const out = vm.dump(result.value) as string[];
    result.value.dispose();
    return out;
  } finally {
    disposed = true;
    for (const d of pending) d.dispose();
    vm.dispose();
    runtime.dispose();
  }
}

// ── Restricted fetch ──────────────────────────────────────────────────────────

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const)
  blocked.addSubnet(net, prefix, "ipv6");

export function isBlockedAddress(addr: string): boolean {
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) addr = mapped[1];
  const family = isIP(addr);
  if (!family) return true;
  return blocked.check(addr, family === 4 ? "ipv4" : "ipv6");
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("only http(s) allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isBlockedAddress(a.address))) throw new Error("address not allowed");
}

interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

// ponytail: resolve-then-fetch is open to DNS rebinding; pin the resolved IP per connection if that matters
export async function safeFetch(rawUrl: string, init: FetchInit = {}) {
  let url = new URL(rawUrl);
  const signal = AbortSignal.timeout(DEADLINE_MS);
  for (let hop = 0; ; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      redirect: "manual",
      signal,
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= MAX_REDIRECTS) throw new Error("too many redirects");
      url = new URL(location, url);
      continue;
    }
    return { ok: res.ok, status: res.status, body: await readCapped(res) };
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    size += r.value.length;
    if (size > MAX_BODY) {
      reader.cancel().catch(() => {});
      throw new Error("response too large");
    }
    chunks.push(r.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

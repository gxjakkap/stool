import { expect, test, mock } from "bun:test";
import { generateKeyPairSync, createSign } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
globalThis.fetch = mock(async () => Response.json({ data: { public_key: pem } })) as any;

process.env.DB_PATH = ":memory:";
const { webhookRoutes } = await import("../modules/webhook");
const { chatManager } = await import("../services/chat-manager");
const { Elysia } = await import("elysia");
const app = new Elysia().use(webhookRoutes);

function post(body: string, sig: string) {
  return app.handle(
    new Request("http://localhost/api/webhook/kick", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "kick-event-message-id": "m1",
        "kick-event-message-timestamp": "2025-01-14T16:08:06Z",
        "kick-event-type": "chat.message.sent",
        "kick-event-signature": sig,
      },
      body,
    })
  );
}

test("kick webhook verifies signature and broadcasts chat", async () => {
  const body = JSON.stringify({
    message_id: "abc",
    sender: { username: "bob", identity: { username_color: "#FF5733", badges: [{ type: "moderator" }] } },
    content: "hi [emote:37226:KEKW]",
  });
  const sig = createSign("RSA-SHA256").update(`m1.2025-01-14T16:08:06Z.${body}`).sign(privateKey, "base64");

  const got: any[] = [];
  const unsub = chatManager.subscribe((m) => got.push(m));

  expect((await post(body, sig)).status).toBe(200);
  expect(got).toEqual([
    expect.objectContaining({ id: "abc", platform: "kick", username: "bob", userColor: "#FF5733", badges: ["moderator"] }),
  ]);

  expect((await post(body.replace("hi", "yo"), sig)).status).toBe(401);
  expect(got.length).toBe(1);
  unsub();
});

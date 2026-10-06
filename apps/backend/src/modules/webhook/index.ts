import { Elysia } from "elysia";
import { addDonation, getSetting } from "../../db/client";
import { WebhookModel } from "./model";
import { chatManager } from "../../services/chat-manager";
import { mapKickEvent, verifyKickSignature } from "../../connectors/kick";

export const webhookRoutes = new Elysia({ prefix: "/api/webhook" })
  .onError(({ code, error }) => {
    if (code === 'VALIDATION') {
      console.error('[Webhook] Validation Error:', error.all);
    }
  })
  .model({
    "webhook.ezdnBody": WebhookModel.ezdnBody,
    "webhook.ezdnResponse": WebhookModel.ezdnResponse,
  })
  .post(
    "/ezdn",
    ({ body }) => {
      const { referenceNo, channelName, donateMessage, donatorName, amount, time } = body;
      addDonation(referenceNo, channelName, donateMessage, donatorName, amount, new Date(time));
      console.log(body)

        chatManager.broadcast({
          id: crypto.randomUUID(),
          type: "donation",
          referenceNo,
          donatorName,
          channelName,
          donateMessage,
          amount,
          time: new Date(time).getTime(),
        });

      return { status: 200, message: "success" };
    },
    {
      body: "webhook.ezdnBody",
      response: { 200: "webhook.ezdnResponse" },
    }
  )
  .post(
    "/kick",
    async ({ body: raw, headers, set }) => {
      const body = raw as string;
      const id = headers["kick-event-message-id"] ?? "";
      const ok = await verifyKickSignature(
        id,
        headers["kick-event-message-timestamp"] ?? "",
        body,
        headers["kick-event-signature"] ?? ""
      ).catch((e) => {
        console.error("[Webhook] Kick signature check failed:", e);
        return false;
      });
      if (!ok) {
        set.status = 401;
        return "invalid signature";
      }
      const msg = mapKickEvent(
        headers["kick-event-type"] ?? "",
        id,
        JSON.parse(body),
        getSetting("kick_bot_user_id") ?? ""
      );
      if (msg) chatManager.broadcast(msg);
      return "ok";
    },
    // Raw text body: the signature covers the exact bytes Kick sent
    { parse: "text" }
  );

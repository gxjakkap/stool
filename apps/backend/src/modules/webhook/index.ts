import { Elysia } from "elysia";
import { addDonation } from "../../db/client";
import { WebhookModel } from "./model";
import { chatManager } from "../../services/chat-manager";
import { TtsService } from "../../services/tts";

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
  );

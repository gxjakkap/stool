import { Elysia } from "elysia";
import { addDonation } from "../../db/client";
import { WebhookModel } from "./model";

export const webhookRoutes = new Elysia({ prefix: "/api/webhook" })
  .model({
    "webhook.ezdnBody": WebhookModel.ezdnBody,
    "webhook.ezdnResponse": WebhookModel.ezdnResponse,
  })
  .post(
    "/ezdn",
    ({ body }) => {
      const { referenceNo, channelName, donateMessage, donatorName, amount, time } = body;
      addDonation(referenceNo, channelName, donateMessage, donatorName, amount, new Date(time));
      return { status: 200, message: "success" };
    },
    {
      body: "webhook.ezdnBody",
      response: { 200: "webhook.ezdnResponse" },
    }
  );

import { t, type UnwrapSchema } from "elysia";

export const WebhookModel = {
  ezdnBody: t.Object({
    referenceNo: t.String(),
    channelName: t.String(),
    donatorName: t.String(),
    donateMessage: t.Nullable(t.String()),
    amount: t.Number(),
    time: t.String(),
  }),
  ezdnResponse: t.Object({
    status: t.Number(),
    message: t.String(),
  }),
} as const;

export type WebhookModel = {
  [k in keyof typeof WebhookModel]: UnwrapSchema<(typeof WebhookModel)[k]>;
};

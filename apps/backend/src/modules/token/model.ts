import { t, type UnwrapSchema } from "elysia";

export const TokenModel = {
  overlayToken: t.Object({
    token: t.String(),
    label: t.String(),
    created_at: t.Number(),
  }),
  createBody: t.Object({
    label: t.String(),
  }),
  deleteParams: t.Object({
    token: t.String(),
  }),
  okResponse: t.Object({
    ok: t.Boolean(),
  }),
} as const;

export type TokenModel = {
  [k in keyof typeof TokenModel]: UnwrapSchema<(typeof TokenModel)[k]>;
};

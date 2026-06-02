import { t, type UnwrapSchema } from "elysia";

export const AuthModel = {
  meResponse: t.Object({
    sub: t.String(),
    email: t.Optional(t.String()),
    name: t.Optional(t.String()),
  }),
  errorResponse: t.Object({
    error: t.String(),
  }),
} as const;

export type AuthModel = {
  [k in keyof typeof AuthModel]: UnwrapSchema<(typeof AuthModel)[k]>;
};

/** Session data stored in memory */
export interface SessionData {
  sub: string;
  email?: string;
  name?: string;
}

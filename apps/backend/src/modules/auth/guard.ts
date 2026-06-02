import { Elysia } from "elysia";
import { SESSIONS } from "./service";

export const authGuard = new Elysia({ name: "auth.guard" })
  .derive({ as: "scoped" }, ({ cookie }) => {
    const sessionId = cookie.session.value as string | undefined;
    if (!sessionId || !SESSIONS.has(sessionId)) {
      throw new Error("Unauthorized");
    }
    const session = SESSIONS.get(sessionId)!;
    return { session };
  })
  .onError({ as: "scoped" }, ({ error, set }) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "Unauthorized") {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  });

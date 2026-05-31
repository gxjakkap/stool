import Elysia from "elysia";
import { SESSIONS } from "../routes/auth";

/**
 * Elysia plugin that guards routes with session-cookie authentication.
 * Returns 401 JSON if the session cookie is missing or invalid.
 */
export const requireAuth = new Elysia({ name: "require-auth" })
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


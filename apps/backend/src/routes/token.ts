import Elysia from "elysia";
import { createToken, deleteToken, listTokens } from "../services/token";
import { requireAuth } from "../middleware/auth-guard";

export const tokenRoutes = new Elysia({ prefix: "/api/tokens" })
  .use(requireAuth)
  .get("/", () => listTokens())
  .post("/", ({ body }) => {
    const label = (body as any)?.label ?? "";
    return createToken(label);
  })
  .delete("/:token", ({ params }) => {
    deleteToken(params.token);
    return { ok: true };
  });

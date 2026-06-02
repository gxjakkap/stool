import { Elysia, t } from "elysia";
import { TokenService } from "./service";
import { TokenModel } from "./model";
import { authGuard } from "../auth/guard";

export const tokenRoutes = new Elysia({ prefix: "/api/tokens" })
  .model({
    "token.overlayToken": TokenModel.overlayToken,
    "token.createBody": TokenModel.createBody,
    "token.deleteParams": TokenModel.deleteParams,
    "token.okResponse": TokenModel.okResponse,
  })
  .use(authGuard)
  .get("/", () => TokenService.list(), {
    response: { 200: t.Array(TokenModel.overlayToken) },
  })
  .post(
    "/",
    ({ body }) => TokenService.create(body.label),
    {
      body: "token.createBody",
      response: { 200: "token.overlayToken" },
    }
  )
  .delete(
    "/:token",
    ({ params }) => {
      TokenService.delete(params.token);
      return { ok: true };
    },
    {
      params: "token.deleteParams",
      response: { 200: "token.okResponse" },
    }
  );

import { Elysia } from "elysia";
import { AuthService } from "./service";
import { AuthModel } from "./model";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .model({ "auth.meResponse": AuthModel.meResponse })
  .get("/login", async ({ redirect }) => {
    try {
      const authUrl = await AuthService.beginLogin();
      return redirect(authUrl.href);
    } catch (e: any) {
      return new Response(`OIDC Error: ${e.message}`, { status: 500 });
    }
  })
  .get("/callback", async ({ request, redirect, cookie }) => {
    try {
      const { sessionId } = await AuthService.handleCallback(
        new URL(request.url)
      );

      cookie.session.set({
        value: sessionId,
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 86400 * 7,
        path: "/",
      });

      return redirect(process.env.FRONTEND_ORIGIN ?? "/");
    } catch (e: any) {
      return new Response(`Auth Error: ${e.message}`, { status: 500 });
    }
  })
  .get("/logout", ({ cookie, redirect }) => {
    const sessionId = cookie.session.value as string | undefined;
    if (sessionId) {
      AuthService.deleteSession(sessionId);
      cookie.session.remove();
    }
    return redirect("/login");
  })
  .get(
    "/me",
    ({ cookie }) => {
      const sessionId = cookie.session.value as string | undefined;
      if (!sessionId) return new Response("Unauthorized", { status: 401 });
      const session = AuthService.getSession(sessionId);
      if (!session) return new Response("Unauthorized", { status: 401 });
      return session;
    },
    { response: { 200: "auth.meResponse" } }
  );

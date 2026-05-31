import Elysia from "elysia";
import { validateToken } from "../services/token";
import { chatManager } from "../services/chat-manager";
import { SESSIONS } from "./auth";

export const wsRoutes = new Elysia()
  .ws("/ws", {
    open(ws) {
      // Validate token or session
      const url = new URL(ws.data.request.url);
      const token = url.searchParams.get("token");
      const cookieHeader = ws.data.request.headers.get("cookie") ?? "";

      let authorized = false;

      if (token && validateToken(token)) {
        authorized = true;
      } else {
        // Check session cookie
        const sessionMatch = cookieHeader.match(/session=([^;]+)/);
        const sessionId = sessionMatch?.[1];
        if (sessionId && SESSIONS.has(sessionId)) {
          authorized = true;
        }
      }

      if (!authorized) {
        ws.send(JSON.stringify({ error: "Unauthorized" }));
        ws.close();
        return;
      }

      (ws as any)._unsubscribe = chatManager.subscribe((msg) => {
        ws.send(JSON.stringify(msg));
      });

      console.log("[WS] Client connected (authorized)");
    },
    close(ws) {
      (ws as any)._unsubscribe?.();
      console.log("[WS] Client disconnected");
    },
    message(_ws, _message) {
      // No-op: server only pushes
    },
  });

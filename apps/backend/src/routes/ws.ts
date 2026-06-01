import Elysia from "elysia";
import { validateToken } from "../services/token";
import { chatManager } from "../services/chat-manager";
import { emoteCache } from "../services/emote-cache";
import { SESSIONS } from "./auth";

export const wsRoutes = new Elysia()
  .ws("/ws", {
    open(ws) {
      // auth
      const url = new URL(ws.data.request.url);
      const token = url.searchParams.get("token");
      const cookieHeader = ws.data.request.headers.get("cookie") ?? "";

      let authorized = false;
      if (token && validateToken(token)) {
        authorized = true;
      } else {
        const sessionMatch = cookieHeader.match(/session=([^;]+)/);
        const sessionId = sessionMatch?.[1];
        if (sessionId && SESSIONS.has(sessionId)) authorized = true;
      }

      if (!authorized) {
        ws.send(JSON.stringify({ error: "Unauthorized" }));
        ws.close();
        return;
      }

      // push emotes
      const sendEmotes = (emotes: { code: string; url: string }[]) => {
        if (emotes.length === 0) return;
        ws.send(JSON.stringify({ type: "emotes", emotes }));
      };

      // If emotes are already ready, push immediately; otherwise subscribe
      if (emoteCache.isInitialized()) {
        sendEmotes(emoteCache.getEmotes());
      }
      const unsubEmotes = emoteCache.subscribe(sendEmotes);

      //messages
      const unsubChat = chatManager.subscribe((msg) => {
        ws.send(JSON.stringify(msg));
      });

      (ws as any)._cleanup = () => {
        unsubEmotes();
        unsubChat();
      };

      console.log("[WS] Client connected (authorized)");
    },

    close(ws) {
      (ws as any)._cleanup?.();
      console.log("[WS] Client disconnected");
    },

    message(_ws, _message) {},
  });

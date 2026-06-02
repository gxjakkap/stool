import { Elysia } from "elysia";
import { TokenService } from "../token/service";
import { SESSIONS } from "../auth/service";
import { chatManager } from "../../services/chat-manager";
import { emoteCache } from "../../services/emote-cache";

export const wsRoutes = new Elysia().ws("/ws", {
  open(ws) {
    const url = new URL(ws.data.request.url);
    const token = url.searchParams.get("token");
    const cookieHeader = ws.data.request.headers.get("cookie") ?? "";

    let authorized = false;
    if (token && TokenService.validate(token)) {
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

    const sendEmotes = (emotes: { code: string; url: string }[]) => {
      if (emotes.length === 0) return;
      ws.send(JSON.stringify({ type: "emotes", emotes }));
    };

    if (emoteCache.isInitialized()) {
      sendEmotes(emoteCache.getEmotes());
    }
    const unsubEmotes = emoteCache.subscribe(sendEmotes);
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

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { migrate } from "./db/schema";
import { settingsRoutes } from "./routes/settings";
import { tokenRoutes } from "./routes/token";
import { authRoutes } from "./routes/auth";
import { wsRoutes } from "./routes/ws";
import { chatManager } from "./services/chat-manager";

// Run migrations
migrate();

const PORT = Number(process.env.BACKEND_PORT ?? 4000);

const app = new Elysia()
  .use(cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  }))
  .use(authRoutes)
  .use(settingsRoutes)
  .use(tokenRoutes)
  .use(wsRoutes)
  .get("/health", () => ({ ok: true, timestamp: Date.now() }))
  .listen(PORT);

console.log(`[stool backend] Listening on http://localhost:${PORT}`);

// Start chat connectors from saved settings
chatManager.restartFromSettings().catch(console.error);

export type App = typeof app;

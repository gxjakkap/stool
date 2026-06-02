import { Elysia, t } from "elysia";
import { TtsService } from "../../services/tts";

export const ttsRoutes = new Elysia({ prefix: "/api/tts" }).get(
  "/",
  async ({ query }) => {
    const { text, voice } = query;
    const audio = await TtsService.generate(text, voice);
    if (!audio) {
      return new Response(JSON.stringify({ error: "Failed to generate TTS" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    return { audio };
  },
  {
    query: t.Object({
      text: t.String(),
      voice: t.Optional(t.String()),
    }),
  }
);

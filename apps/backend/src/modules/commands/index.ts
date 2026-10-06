import { Elysia, t } from "elysia";
import { addCommand, addTimer, deleteCommand, deleteTimer, editCommand, listCommands, listTimers, updateTimer } from "../../db/client";
import { MAX_RESPONSE, MAX_TRIGGER, triggerError } from "../../services/bot";
import { renderTemplate } from "../../services/macro";
import { authGuard } from "../auth/guard";

const commandBody = t.Object({
  trigger: t.String({ minLength: 1, maxLength: MAX_TRIGGER }),
  response: t.String({ minLength: 1, maxLength: MAX_RESPONSE }),
  prefixUser: t.Boolean(),
});

const timerBody = t.Object({
  message: t.String({ minLength: 1, maxLength: MAX_RESPONSE }),
  intervalMinutes: t.Integer({ minimum: 1 }),
  minLines: t.Integer({ minimum: 0 }),
  platforms: t.Array(t.Union([t.Literal("twitch"), t.Literal("kick")]), { minItems: 1 }),
  enabled: t.Boolean(),
});

const timerResponse = t.Object({
  id: t.Integer(),
  message: t.String(),
  intervalMinutes: t.Integer(),
  minLines: t.Integer(),
  platforms: t.Array(t.Union([t.Literal("twitch"), t.Literal("kick")])),
  enabled: t.Boolean(),
});

const toTimerRow = (b: typeof timerBody.static) => ({
  message: b.message,
  interval_minutes: b.intervalMinutes,
  min_lines: b.minLines,
  platforms: [...new Set(b.platforms)].join(","),
  enabled: b.enabled ? 1 : 0,
});

export const commandRoutes = new Elysia({ prefix: "/api" })
  // Public: backs the read-only list that !commands links to. Macro source can hold API keys, so it is hidden.
  .get("/commands/public", () =>
    listCommands().map((c) => ({ trigger: c.trigger, response: c.response.includes("${") ? null : c.response }))
  )
  .use(authGuard)
  .get(
    "/commands",
    () => listCommands().map((c) => ({ trigger: c.trigger, response: c.response, prefixUser: !!c.prefix_user })),
    { response: { 200: t.Array(commandBody) } }
  )
  .post(
    "/commands",
    ({ body, status }) => {
      const err = triggerError(body.trigger);
      if (err) return status(400, { error: err });
      if (!addCommand(body.trigger, body.response, body.prefixUser, "dashboard")) return status(409, { error: "command already exists" });
      return { ok: true };
    },
    { body: commandBody }
  )
  .put(
    "/commands",
    ({ body, status }) =>
      editCommand(body.trigger, body.response, body.prefixUser) ? { ok: true } : status(404, { error: "command does not exist" }),
    { body: commandBody }
  )
  .delete(
    "/commands",
    ({ query, status }) => (deleteCommand(query.trigger) ? { ok: true } : status(404, { error: "command does not exist" })),
    { query: t.Object({ trigger: t.String() }) }
  )
  .post(
    "/commands/test",
    async ({ body }) => {
      try {
        const output = await renderTemplate(body.response, {
          user: body.user ?? "tester",
          args: body.args ?? [],
          query: (body.args ?? []).join(" "),
          platform: body.platform ?? "twitch",
        });
        return { output };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    {
      body: t.Object({
        response: t.String({ maxLength: MAX_RESPONSE }),
        user: t.Optional(t.String()),
        args: t.Optional(t.Array(t.String())),
        platform: t.Optional(t.String()),
      }),
    }
  )
  .get("/timers", () =>
    listTimers().map((r) => ({
      id: r.id,
      message: r.message,
      intervalMinutes: r.interval_minutes,
      minLines: r.min_lines,
      platforms: r.platforms.split(",") as ("twitch" | "kick")[],
      enabled: !!r.enabled,
    })),
    { response: { 200: t.Array(timerResponse) } }
  )
  .post("/timers", ({ body }) => ({ id: addTimer(toTimerRow(body)).id }), {
    body: timerBody,
    response: { 200: t.Object({ id: t.Integer() }) },
  })
  .put(
    "/timers/:id",
    ({ params, body, status }) => (updateTimer(params.id, toTimerRow(body)) ? { ok: true } : status(404, { error: "timer not found" })),
    { params: t.Object({ id: t.Numeric() }), body: timerBody }
  )
  .delete(
    "/timers/:id",
    ({ params, status }) => (deleteTimer(params.id) ? { ok: true } : status(404, { error: "timer not found" })),
    { params: t.Object({ id: t.Numeric() }) }
  );

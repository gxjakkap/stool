import { db } from "./schema";

export function getSetting(key: string): string | null {
  const row = db
    .query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?")
    .get(key);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db
    .query<{ key: string; value: string }, []>("SELECT key, value FROM settings")
    .all();
  return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
}


export function addDonation(referenceNo: string, channelName: string, donateMessage: string | null, donatorName: string, amount: number, time: Date){
  db.query(
    `INSERT INTO donation (ref_no, channel_name, donator_name, donate_message, amount, time, read)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(referenceNo, channelName, donatorName, donateMessage, amount, Math.floor(time.valueOf() / 1000), false)
}

// ── Bot commands ──────────────────────────────────────────────────────────────

export interface CommandRow {
  trigger: string;
  response: string;
  prefix_user: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export function getCommand(trigger: string): CommandRow | null {
  return db.query<CommandRow, [string]>("SELECT * FROM commands WHERE trigger = ?").get(trigger.toLowerCase());
}

export function listCommands(): CommandRow[] {
  return db.query<CommandRow, []>("SELECT * FROM commands ORDER BY trigger").all();
}

/** Returns false if the trigger already exists. */
export function addCommand(trigger: string, response: string, prefixUser: boolean, createdBy: string): boolean {
  const res = db
    .query("INSERT INTO commands (trigger, response, prefix_user, created_by) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING")
    .run(trigger.toLowerCase(), response, prefixUser ? 1 : 0, createdBy);
  return res.changes > 0;
}

/** prefixUser undefined keeps the current flag. Returns false if the trigger does not exist. */
export function editCommand(trigger: string, response: string, prefixUser?: boolean): boolean {
  const res = db
    .query(
      "UPDATE commands SET response = ?, prefix_user = COALESCE(?, prefix_user), updated_at = unixepoch() WHERE trigger = ?"
    )
    .run(response, prefixUser === undefined ? null : prefixUser ? 1 : 0, trigger.toLowerCase());
  return res.changes > 0;
}

export function deleteCommand(trigger: string): boolean {
  return db.query("DELETE FROM commands WHERE trigger = ?").run(trigger.toLowerCase()).changes > 0;
}

// ── Timers ────────────────────────────────────────────────────────────────────

export interface TimerRow {
  id: number;
  message: string;
  interval_minutes: number;
  min_lines: number;
  platforms: string;
  enabled: number;
}

export type TimerInput = Omit<TimerRow, "id">;

export function listTimers(): TimerRow[] {
  return db.query<TimerRow, []>("SELECT * FROM timers ORDER BY id").all();
}

export function addTimer(t: TimerInput): TimerRow {
  return db
    .query<TimerRow, [string, number, number, string, number]>(
      "INSERT INTO timers (message, interval_minutes, min_lines, platforms, enabled) VALUES (?, ?, ?, ?, ?) RETURNING *"
    )
    .get(t.message, t.interval_minutes, t.min_lines, t.platforms, t.enabled)!;
}

export function updateTimer(id: number, t: TimerInput): boolean {
  return (
    db
      .query("UPDATE timers SET message = ?, interval_minutes = ?, min_lines = ?, platforms = ?, enabled = ? WHERE id = ?")
      .run(t.message, t.interval_minutes, t.min_lines, t.platforms, t.enabled, id).changes > 0
  );
}

export function deleteTimer(id: number): boolean {
  return db.query("DELETE FROM timers WHERE id = ?").run(id).changes > 0;
}

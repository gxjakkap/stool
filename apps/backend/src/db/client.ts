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
    VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(referenceNo, channelName, donatorName, donateMessage, amount, Math.floor(time.valueOf() / 1000), false)
}
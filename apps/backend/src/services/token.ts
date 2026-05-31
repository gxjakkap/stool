import { db } from "../db/schema";
import { nanoid } from "nanoid";
import type { OverlayToken } from "../types";

export function createToken(label: string): OverlayToken {
  const token = nanoid(32);
  db.query("INSERT INTO overlay_tokens (token, label) VALUES (?, ?)").run(token, label);
  const row = db
    .query<OverlayToken, [string]>("SELECT * FROM overlay_tokens WHERE token = ?")
    .get(token);
  return row!;
}

export function validateToken(token: string): boolean {
  const row = db
    .query<{ token: string }, [string]>("SELECT token FROM overlay_tokens WHERE token = ?")
    .get(token);
  return !!row;
}

export function listTokens(): OverlayToken[] {
  return db
    .query<OverlayToken, []>("SELECT * FROM overlay_tokens ORDER BY created_at DESC")
    .all();
}

export function deleteToken(token: string): void {
  db.query("DELETE FROM overlay_tokens WHERE token = ?").run(token);
}

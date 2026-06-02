import { db } from "../../db/schema";
import { nanoid } from "nanoid";
import type { TokenModel } from "./model";

export abstract class TokenService {
  static create(label: string): TokenModel["overlayToken"] {
    const token = nanoid(32);
    db.query("INSERT INTO overlay_tokens (token, label) VALUES (?, ?)").run(
      token,
      label
    );
    const row = db
      .query<TokenModel["overlayToken"], [string]>(
        "SELECT * FROM overlay_tokens WHERE token = ?"
      )
      .get(token);
    return row!;
  }

  static validate(token: string): boolean {
    const row = db
      .query<{ token: string }, [string]>(
        "SELECT token FROM overlay_tokens WHERE token = ?"
      )
      .get(token);
    return !!row;
  }

  static list(): TokenModel["overlayToken"][] {
    return db
      .query<TokenModel["overlayToken"], []>(
        "SELECT * FROM overlay_tokens ORDER BY created_at DESC"
      )
      .all();
  }

  static delete(token: string): void {
    db.query("DELETE FROM overlay_tokens WHERE token = ?").run(token);
  }
}

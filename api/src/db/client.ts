import { SQL } from 'bun';

export const sql = new SQL(process.env.DATABASE_URL || 'postgres://localhost:5432/matchpoint');

/** Bun returns JSONB as objects already; this guards against text columns or nulls. */
export function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}

/** Value for a `${j(x)}::jsonb` parameter. Bun serialises objects/arrays itself; pre-stringifying would store a JSON string. */
export const j = (v: unknown) => (v === undefined ? null : v);

export async function notify(userId: number, text: string, link = '') {
  await sql`INSERT INTO notifications (user_id, text, link) VALUES (${userId}, ${text}, ${link})`;
}

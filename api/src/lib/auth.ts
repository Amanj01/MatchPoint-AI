import { sql } from '../db/client';
import { HttpError, type Ctx, type SessionUser } from './http';

export const COOKIE = 'mp_session';
const MAX_AGE = 60 * 60 * 24 * 14;

export const hashPassword = (pw: string) => Bun.password.hash(pw, { algorithm: 'bcrypt', cost: 10 });
export const verifyPassword = (pw: string, hash: string) => Bun.password.verify(pw, hash);

export function readToken(req: Request) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

export async function loadUser(req: Request): Promise<SessionUser | null> {
  const token = readToken(req);
  if (!token) return null;
  const [row] = await sql`
    SELECT u.id, u.email, u.name, u.role, u.avatar_color, c.id AS company_id, c.name AS company_name
    FROM sessions s JOIN users u ON u.id = s.user_id
    LEFT JOIN companies c ON c.owner_id = u.id
    WHERE s.token = ${token} AND s.created_at > now() - interval '14 days'`;
  return row ?? null;
}

export async function startSession(userId: number) {
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '');
  await sql`INSERT INTO sessions (token, user_id) VALUES (${token}, ${userId})`;
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export const clearCookie = `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;

export function need(ctx: Ctx, role?: 'candidate' | 'employer'): SessionUser {
  if (!ctx.user) throw new HttpError(401, 'Please log in first.');
  if (role && ctx.user.role !== role) throw new HttpError(403, `Only ${role}s can do this.`);
  return ctx.user;
}

export function needCompany(ctx: Ctx) {
  const u = need(ctx, 'employer');
  if (!u.company_id) throw new HttpError(400, 'Create your company profile first.');
  return u as SessionUser & { company_id: number };
}

import { sql } from '../db/client';
import { clearCookie, hashPassword, loadUser, startSession, verifyPassword } from '../lib/auth';
import { body, HttpError, str, type Handler } from '../lib/http';

const COLORS = ['#4f46e5', '#0f766e', '#b45309', '#be123c', '#7c3aed', '#0369a1', '#15803d', '#c2410c'];

export const register: Handler = async (req, ctx) => {
  const b = await body(req);
  const email = str(b.email, 200).toLowerCase();
  const name = str(b.name, 120);
  const role = b.role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email.');
  if (String(b.password || '').length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (!name) throw new HttpError(400, 'Name is required.');
  if (!['candidate', 'employer'].includes(role)) throw new HttpError(400, 'Choose candidate or employer.');
  if (role === 'employer' && !str(b.company)) throw new HttpError(400, 'Company name is required for employers.');
  const [exists] = await sql`SELECT 1 FROM users WHERE email = ${email}`;
  if (exists) throw new HttpError(409, 'That email is already registered.');

  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const [user] = await sql`INSERT INTO users (email, password_hash, name, role, avatar_color)
    VALUES (${email}, ${await hashPassword(b.password)}, ${name}, ${role}, ${color}) RETURNING id`;
  if (role === 'candidate') await sql`INSERT INTO profiles (user_id) VALUES (${user.id})`;
  else await sql`INSERT INTO companies (owner_id, name, industry, color) VALUES (${user.id}, ${str(b.company, 120)}, ${str(b.industry, 80)}, ${color})`;

  ctx.setCookie = await startSession(user.id);
  return { user: await meFor(ctx, user.id) };
};

export const login: Handler = async (req, ctx) => {
  const b = await body(req);
  const [user] = await sql`SELECT id, password_hash FROM users WHERE email = ${str(b.email).toLowerCase()}`;
  if (!user || !(await verifyPassword(String(b.password || ''), user.password_hash))) throw new HttpError(401, 'Wrong email or password.');
  ctx.setCookie = await startSession(user.id);
  return { user: await meFor(ctx, user.id) };
};

export const logout: Handler = async (req, ctx) => {
  const cookie = req.headers.get('cookie') || '';
  const token = cookie.match(/mp_session=([^;]+)/)?.[1];
  if (token) await sql`DELETE FROM sessions WHERE token = ${token}`;
  ctx.setCookie = clearCookie;
  return { ok: true };
};

export const me: Handler = (_req, ctx) => ({ user: ctx.user });

async function meFor(ctx: any, id: number) {
  const [row] = await sql`SELECT u.id, u.email, u.name, u.role, u.avatar_color, c.id AS company_id, c.name AS company_name
    FROM users u LEFT JOIN companies c ON c.owner_id = u.id WHERE u.id = ${id}`;
  return row;
}

export { loadUser };

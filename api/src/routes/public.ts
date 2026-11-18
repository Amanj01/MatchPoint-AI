import { sql } from '../db/client';
import { aiStatus } from '../lib/ai';
import { type Handler } from '../lib/http';

export const stats: Handler = async () => {
  const [s] = await sql`SELECT
    (SELECT count(*)::int FROM jobs WHERE status = 'open') AS open_jobs,
    (SELECT count(*)::int FROM companies) AS companies,
    (SELECT count(*)::int FROM users WHERE role = 'candidate') AS candidates,
    (SELECT count(*)::int FROM cvs) AS cvs,
    (SELECT count(*)::int FROM applications) AS applications,
    (SELECT count(*)::int FROM applications WHERE status IN ('offer','hired')) AS offers,
    (SELECT count(*)::int FROM applications WHERE created_at > now() - interval '1 day') AS applications_today`;
  return s;
};

/** Anonymised live activity feed for the landing page. */
export const activity: Handler = async () => {
  const rows = await sql`
    (SELECT 'applied' AS kind, split_part(u.name, ' ', 1) AS who, j.title, c.name AS company, a.created_at AS at
       FROM applications a JOIN users u ON u.id = a.user_id JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
       ORDER BY a.created_at DESC LIMIT 8)
    UNION ALL
    (SELECT 'hired' AS kind, split_part(u.name, ' ', 1), j.title, c.name, a.updated_at
       FROM applications a JOIN users u ON u.id = a.user_id JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
       WHERE a.status IN ('offer','hired') ORDER BY a.updated_at DESC LIMIT 4)
    UNION ALL
    (SELECT 'posted', '', j.title, c.name, j.created_at FROM jobs j JOIN companies c ON c.id = j.company_id ORDER BY j.created_at DESC LIMIT 5)
    UNION ALL
    (SELECT 'cv', split_part(u.name, ' ', 1), '', '', cv.updated_at FROM cvs cv JOIN users u ON u.id = cv.user_id ORDER BY cv.updated_at DESC LIMIT 4)
    ORDER BY at DESC LIMIT 14`;
  return { items: rows };
};

export const companies: Handler = async () => {
  const rows = await sql`SELECT c.id, c.name, c.industry, c.location, c.color, c.size,
      (SELECT count(*)::int FROM jobs j WHERE j.company_id = c.id AND j.status = 'open') AS open_jobs
    FROM companies c ORDER BY open_jobs DESC, c.name LIMIT 24`;
  return { companies: rows };
};

export const ai: Handler = async (_req, ctx) => aiStatus(ctx.user?.id);

export const notifications: Handler = async (_req, ctx) => {
  if (!ctx.user) return { items: [], unread: 0 };
  const items = await sql`SELECT * FROM notifications WHERE user_id = ${ctx.user.id} ORDER BY created_at DESC LIMIT 30`;
  return { items, unread: items.filter((n: any) => !n.read).length };
};

export const readNotifications: Handler = async (_req, ctx) => {
  if (ctx.user) await sql`UPDATE notifications SET read = true WHERE user_id = ${ctx.user.id}`;
  return { ok: true };
};

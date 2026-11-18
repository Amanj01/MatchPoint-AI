import { sql, j } from '../db/client';
import { aiMode, generateCV } from '../lib/ai';
import { need } from '../lib/auth';
import { loadCandidate, loadJobs } from '../lib/data';
import { body, HttpError, str, strList, type Handler } from '../lib/http';
import { profileStrength, scoreMatch } from '../lib/match';

const objList = (v: unknown, keys: string[], max = 12) =>
  (Array.isArray(v) ? v : []).slice(0, max).map((o: any) => {
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = k === 'tech' ? strList(o?.[k], 15) : str(o?.[k], 1500);
    return out;
  }).filter((o) => Object.values(o).some((x) => (Array.isArray(x) ? x.length : x)));

export const getProfile: Handler = async (_req, ctx) => {
  const user = need(ctx, 'candidate');
  const me = await loadCandidate(user.id);
  return { profile: me.profile, strength: profileStrength(me.profile, !!me.cv), hasCv: !!me.cv };
};

export const saveProfile: Handler = async (req, ctx) => {
  const user = need(ctx, 'candidate');
  const b = await body(req);
  const years = Math.max(0, Math.min(40, Number(b.years_experience) || 0));
  await sql`INSERT INTO profiles (user_id) VALUES (${user.id}) ON CONFLICT DO NOTHING`;
  await sql`UPDATE profiles SET
      headline = ${str(b.headline, 200)}, desired_role = ${str(b.desired_role, 120)}, location = ${str(b.location, 120)},
      phone = ${str(b.phone, 40)}, links = ${str(b.links, 300)}, passion = ${str(b.passion, 2000)},
      years_experience = ${years},
      skills = ${j(strList(b.skills, 40))}::jsonb,
      experience = ${j(objList(b.experience, ['title', 'company', 'start', 'end', 'description']))}::jsonb,
      education = ${j(objList(b.education, ['degree', 'school', 'start', 'end', 'details']))}::jsonb,
      projects = ${j(objList(b.projects, ['name', 'description', 'tech', 'link']))}::jsonb,
      languages = ${j(strList(b.languages, 10))}::jsonb,
      open_to_work = ${b.open_to_work !== false},
      updated_at = now()
    WHERE user_id = ${user.id}`;
  return getProfile(req, ctx);
};

export const getCv: Handler = async (_req, ctx) => {
  const user = need(ctx, 'candidate');
  const [row] = await sql`SELECT content, template, ai_mode, updated_at FROM cvs WHERE user_id = ${user.id}`;
  return { cv: row ?? null };
};

/** The AI agent writes the CV from the raw profile. */
export const generate: Handler = async (req, ctx) => {
  const user = need(ctx, 'candidate');
  const b = await body(req);
  const me = await loadCandidate(user.id);
  if (!(me.profile.skills || []).length && !me.profile.passion) throw new HttpError(400, 'Add some skills and tell us about your passion first.');
  const { _ai, ...cv } = await generateCV(user.id, { name: user.name, email: user.email }, me.profile, !!b.regenerate);
  const template = ['modern', 'classic', 'compact'].includes(b.template) ? b.template : 'modern';
  await sql`INSERT INTO cvs (user_id, content, template, ai_mode) VALUES (${user.id}, ${j(cv)}::jsonb, ${template}, ${aiMode()})
    ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content, ai_mode = EXCLUDED.ai_mode, updated_at = now()`;
  return { cv: { content: cv, template, ai_mode: aiMode() }, ai: _ai };
};

/** Manual edits after generation (summary, headline, template). */
export const updateCv: Handler = async (req, ctx) => {
  const user = need(ctx, 'candidate');
  const b = await body(req);
  const [row] = await sql`SELECT content FROM cvs WHERE user_id = ${user.id}`;
  if (!row) throw new HttpError(404, 'Generate your CV first.');
  const content = { ...row.content };
  if (b.headline != null) content.headline = str(b.headline, 200);
  if (b.summary != null) content.summary = str(b.summary, 2000);
  const template = ['modern', 'classic', 'compact'].includes(b.template) ? b.template : undefined;
  await sql`UPDATE cvs SET content = ${j(content)}::jsonb, template = COALESCE(${template ?? null}, template), updated_at = now() WHERE user_id = ${user.id}`;
  return getCv(req, ctx);
};

export const dashboard: Handler = async (_req, ctx) => {
  const user = need(ctx, 'candidate');
  const me = await loadCandidate(user.id);
  const jobs = await loadJobs({ openOnly: true });
  const apps = await sql`SELECT a.job_id, a.status FROM applications a WHERE a.user_id = ${user.id}`;
  const appliedIds = new Set(apps.map((a: any) => a.job_id));
  const recommended = jobs
    .filter((jb) => !appliedIds.has(jb.id))
    .map((jb) => ({ ...jb, match: scoreMatch(me, jb) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 6);

  // Skills that appear most often in jobs this candidate is close to, but which they lack.
  const gap: Record<string, number> = {};
  for (const jb of jobs) {
    const m = scoreMatch(me, jb);
    if (m.score >= 30) for (const s of m.missing) gap[s] = (gap[s] || 0) + 1;
  }
  const skillGaps = Object.entries(gap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([skill, jobs]) => ({ skill, jobs }));

  const counts: Record<string, number> = {};
  for (const a of apps) counts[a.status] = (counts[a.status] || 0) + 1;
  const invites = await sql`SELECT i.job_id, i.message, i.created_at, jb.title, c.name AS company, c.color, c.cover_url AS cover
    FROM invites i JOIN jobs jb ON jb.id = i.job_id JOIN companies c ON c.id = jb.company_id
    WHERE i.user_id = ${user.id} AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = i.job_id AND a.user_id = i.user_id)
    ORDER BY i.created_at DESC`;
  const [views] = await sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${user.id} AND text LIKE '%viewed your CV%' AND created_at > now() - interval '7 days'`;

  return {
    strength: profileStrength(me.profile, !!me.cv),
    hasCv: !!me.cv,
    cvHeadline: me.cv?.headline || '',
    recommended, skillGaps, invites,
    applications: { total: apps.length, ...counts },
    cvViews7d: views.n,
  };
};

export const applications: Handler = async (_req, ctx) => {
  const user = need(ctx, 'candidate');
  const rows = await sql`
    SELECT a.id, a.status, a.match_score, a.created_at, a.updated_at, a.source,
           jb.id AS job_id, jb.title, jb.location, jb.remote, c.name AS company, c.color, c.cover_url AS cover
    FROM applications a JOIN jobs jb ON jb.id = a.job_id JOIN companies c ON c.id = jb.company_id
    WHERE a.user_id = ${user.id} ORDER BY a.updated_at DESC`;
  const events = await sql`SELECT e.application_id, e.status, e.created_at FROM application_events e
    JOIN applications a ON a.id = e.application_id WHERE a.user_id = ${user.id} ORDER BY e.created_at`;
  return { applications: rows.map((r: any) => ({ ...r, events: events.filter((e: any) => e.application_id === r.id) })) };
};

export const saved: Handler = async (_req, ctx) => {
  const user = need(ctx, 'candidate');
  const me = await loadCandidate(user.id);
  const ids = new Set((await sql`SELECT job_id FROM saved_jobs WHERE user_id = ${user.id}`).map((r: any) => r.job_id));
  const jobs = (await loadJobs()).filter((jb) => ids.has(jb.id)).map((jb) => ({ ...jb, match: scoreMatch(me, jb), saved: true }));
  return { jobs };
};

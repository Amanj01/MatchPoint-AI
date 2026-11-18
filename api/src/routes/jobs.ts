import { sql } from '../db/client';
import { coverLetter, fitInsight } from '../lib/ai';
import { need } from '../lib/auth';
import { loadCandidate, loadJob, loadJobs } from '../lib/data';
import { body, HttpError, int, str, type Handler } from '../lib/http';
import { scoreMatch } from '../lib/match';

/** Public job board. Logged-in candidates also get a match score per job. */
export const list: Handler = async (_req, ctx) => {
  const q = (ctx.url.searchParams.get('q') || '').toLowerCase().trim();
  const level = ctx.url.searchParams.get('level') || '';
  const remote = ctx.url.searchParams.get('remote') === '1';
  let jobs: any[] = await loadJobs({ openOnly: true });
  if (q) jobs = jobs.filter((j) => [j.title, j.company.name, j.location, j.description, ...j.requirements].join(' ').toLowerCase().includes(q));
  if (level) jobs = jobs.filter((j) => j.level === level);
  if (remote) jobs = jobs.filter((j) => j.remote);

  if (ctx.user?.role === 'candidate') {
    const me = await loadCandidate(ctx.user.id);
    const applied = new Set((await sql`SELECT job_id FROM applications WHERE user_id = ${ctx.user.id}`).map((r: any) => r.job_id));
    const saved = new Set((await sql`SELECT job_id FROM saved_jobs WHERE user_id = ${ctx.user.id}`).map((r: any) => r.job_id));
    jobs = jobs.map((j) => ({ ...j, match: scoreMatch(me, j), applied: applied.has(j.id), saved: saved.has(j.id) }));
    if (ctx.url.searchParams.get('sort') === 'match') jobs.sort((a, b) => b.match.score - a.match.score);
  }
  return { jobs };
};

export const detail: Handler = async (req, ctx) => {
  const id = int(req.params.id);
  const job = await loadJob(id);
  await sql`UPDATE jobs SET views = views + 1 WHERE id = ${id}`;
  if (ctx.user?.role !== 'candidate') return { job };

  const me = await loadCandidate(ctx.user.id);
  const [application] = await sql`SELECT * FROM applications WHERE job_id = ${id} AND user_id = ${ctx.user.id}`;
  const events = application ? await sql`SELECT status, created_at FROM application_events WHERE application_id = ${application.id} ORDER BY created_at` : [];
  const [saved] = await sql`SELECT 1 FROM saved_jobs WHERE job_id = ${id} AND user_id = ${ctx.user.id}`;
  const [invite] = await sql`SELECT message, created_at FROM invites WHERE job_id = ${id} AND user_id = ${ctx.user.id}`;
  return { job, match: scoreMatch(me, job), application: application ? { ...application, events } : null, saved: !!saved, invite: invite || null, hasCv: !!me.cv };
};

export const writeCoverLetter: Handler = async (req, ctx) => {
  const user = need(ctx, 'candidate');
  const b = await body(req);
  const job = await loadJob(int(req.params.id));
  const me = await loadCandidate(user.id);
  if (!me.cv) throw new HttpError(400, 'Generate your CV first; the cover letter is written from it.');
  return coverLetter(user.id, me.cv, job, job.company, !!b.regenerate);
};

export const insight: Handler = async (req, ctx) => {
  const user = need(ctx, 'candidate');
  const b = await body(req);
  const job = await loadJob(int(req.params.id));
  const me = await loadCandidate(user.id);
  if (!me.cv) throw new HttpError(400, 'Generate your CV first.');
  return fitInsight(user.id, 'candidate', me.cv, job, scoreMatch(me, job), !!b.regenerate);
};

export const apply: Handler = async (req, ctx) => {
  const user = need(ctx, 'candidate');
  const b = await body(req);
  const job = await loadJob(int(req.params.id));
  if (job.status !== 'open') throw new HttpError(400, 'This job is closed.');
  const me = await loadCandidate(user.id);
  if (!me.cv) throw new HttpError(400, 'Create your CV before applying.');
  const [existing] = await sql`SELECT id FROM applications WHERE job_id = ${job.id} AND user_id = ${user.id}`;
  if (existing) throw new HttpError(409, 'You already applied to this job.');

  const [invite] = await sql`SELECT 1 FROM invites WHERE job_id = ${job.id} AND user_id = ${user.id}`;
  const score = scoreMatch(me, job).score;
  const [app] = await sql`INSERT INTO applications (job_id, user_id, cover_letter, match_score, source)
    VALUES (${job.id}, ${user.id}, ${str(b.cover_letter, 6000)}, ${score}, ${invite ? 'invited' : 'direct'}) RETURNING *`;
  await sql`INSERT INTO application_events (application_id, status) VALUES (${app.id}, 'applied')`;
  await sql`INSERT INTO notifications (user_id, text, link)
    VALUES (${job.employer_id}, ${`${user.name} applied to ${job.title} (match ${score}%)`}, ${`/employer/jobs/${job.id}`})`;
  return { application: app };
};

export const withdraw: Handler = async (req, ctx) => {
  const user = need(ctx, 'candidate');
  await sql`DELETE FROM applications WHERE job_id = ${int(req.params.id)} AND user_id = ${user.id} AND status IN ('applied','shortlisted')`;
  return { ok: true };
};

export const toggleSave: Handler = async (req, ctx) => {
  const user = need(ctx, 'candidate');
  const id = int(req.params.id);
  const [row] = await sql`DELETE FROM saved_jobs WHERE user_id = ${user.id} AND job_id = ${id} RETURNING 1`;
  if (!row) await sql`INSERT INTO saved_jobs (user_id, job_id) VALUES (${user.id}, ${id})`;
  return { saved: !row };
};

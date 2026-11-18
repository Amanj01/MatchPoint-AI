import { sql, j, notify } from '../db/client';
import { draftJob, fitInsight } from '../lib/ai';
import { needCompany } from '../lib/auth';
import { candidateCard, loadCandidate, loadJob, loadJobs, loadOpenCandidates } from '../lib/data';
import { body, HttpError, int, str, strList, type Ctx, type Handler } from '../lib/http';
import { scoreMatch } from '../lib/match';

const STATUSES = ['applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'] as const;
const STATUS_TEXT: Record<string, string> = {
  shortlisted: 'shortlisted you for',
  interview: 'invited you to interview for',
  offer: 'made you an offer for',
  hired: 'confirmed your hire for',
  rejected: 'decided not to move forward with your application for',
  applied: 'moved your application back to "applied" for',
};

async function ownJob(ctx: Ctx, id: number) {
  const u = needCompany(ctx);
  const job = await loadJob(id);
  if (job.company.id !== u.company_id) throw new HttpError(403, 'This job belongs to another company.');
  return { u, job };
}

export const dashboard: Handler = async (_req, ctx) => {
  const u = needCompany(ctx);
  const [company] = await sql`SELECT * FROM companies WHERE id = ${u.company_id}`;
  const jobs = await loadJobs({ companyId: u.company_id });
  const pipeline = await sql`SELECT a.status, count(*)::int AS n FROM applications a JOIN jobs jb ON jb.id = a.job_id
    WHERE jb.company_id = ${u.company_id} GROUP BY a.status`;
  const byJob = await sql`SELECT a.job_id, a.status, count(*)::int AS n FROM applications a JOIN jobs jb ON jb.id = a.job_id
    WHERE jb.company_id = ${u.company_id} GROUP BY a.job_id, a.status`;
  const recent = await sql`SELECT a.id, a.match_score, a.status, a.created_at, u.id AS user_id, u.name, u.avatar_color, jb.id AS job_id, jb.title
    FROM applications a JOIN users u ON u.id = a.user_id JOIN jobs jb ON jb.id = a.job_id
    WHERE jb.company_id = ${u.company_id} ORDER BY a.created_at DESC LIMIT 8`;
  const [avg] = await sql`SELECT COALESCE(round(avg(a.match_score)), 0)::int AS n FROM applications a JOIN jobs jb ON jb.id = a.job_id WHERE jb.company_id = ${u.company_id}`;
  const daily = await sql`SELECT to_char(d, 'YYYY-MM-DD') AS day,
      (SELECT count(*)::int FROM applications a JOIN jobs jb ON jb.id = a.job_id WHERE jb.company_id = ${u.company_id} AND a.created_at::date = d::date) AS n
    FROM generate_series(now()::date - 13, now()::date, interval '1 day') d ORDER BY d`;

  return {
    company,
    jobs: jobs.map((jb) => ({ ...jb, pipeline: Object.fromEntries(byJob.filter((r: any) => r.job_id === jb.id).map((r: any) => [r.status, r.n])) })),
    pipeline: Object.fromEntries(pipeline.map((r: any) => [r.status, r.n])),
    recent, avgMatch: avg.n, daily,
  };
};

export const saveCompany: Handler = async (req, ctx) => {
  const u = needCompany(ctx);
  const b = await body(req);
  await sql`UPDATE companies SET name = ${str(b.name, 120) || u.company_name}, industry = ${str(b.industry, 80)}, size = ${str(b.size, 40)},
    location = ${str(b.location, 120)}, website = ${str(b.website, 200)}, about = ${str(b.about, 2000)} WHERE id = ${u.company_id}`;
  const [company] = await sql`SELECT * FROM companies WHERE id = ${u.company_id}`;
  return { company };
};

function jobFields(b: any) {
  const level = ['intern', 'junior', 'mid', 'senior'].includes(b.level) ? b.level : 'junior';
  const title = str(b.title, 120);
  if (!title) throw new HttpError(400, 'Job title is required.');
  const reqs = strList(b.requirements, 15);
  if (!reqs.length) throw new HttpError(400, 'Add at least one required skill so we can match candidates.');
  const n = (v: any) => (v === '' || v == null || isNaN(Number(v)) ? null : Math.round(Number(v)));
  return {
    title, level, location: str(b.location, 120), remote: !!b.remote, type: str(b.type, 30) || 'Full-time',
    salary_min: n(b.salary_min), salary_max: n(b.salary_max), currency: str(b.currency, 5) || 'USD',
    description: str(b.description, 5000), responsibilities: strList(b.responsibilities, 12), requirements: reqs, nice_to_have: strList(b.nice_to_have, 10),
    status: b.status === 'closed' ? 'closed' : 'open',
  };
}

export const createJob: Handler = async (req, ctx) => {
  const u = needCompany(ctx);
  const f = jobFields(await body(req));
  const [row] = await sql`INSERT INTO jobs (company_id, title, level, location, remote, type, salary_min, salary_max, currency, description, responsibilities, requirements, nice_to_have, status)
    VALUES (${u.company_id}, ${f.title}, ${f.level}, ${f.location}, ${f.remote}, ${f.type}, ${f.salary_min}, ${f.salary_max}, ${f.currency}, ${f.description},
            ${j(f.responsibilities)}::jsonb, ${j(f.requirements)}::jsonb, ${j(f.nice_to_have)}::jsonb, ${f.status}) RETURNING id`;
  return { id: row.id };
};

export const updateJob: Handler = async (req, ctx) => {
  const { job } = await ownJob(ctx, int(req.params.id));
  const f = jobFields(await body(req));
  await sql`UPDATE jobs SET title = ${f.title}, level = ${f.level}, location = ${f.location}, remote = ${f.remote}, type = ${f.type},
    salary_min = ${f.salary_min}, salary_max = ${f.salary_max}, currency = ${f.currency}, description = ${f.description},
    responsibilities = ${j(f.responsibilities)}::jsonb, requirements = ${j(f.requirements)}::jsonb, nice_to_have = ${j(f.nice_to_have)}::jsonb, status = ${f.status}
    WHERE id = ${job.id}`;
  return { id: job.id };
};

export const deleteJob: Handler = async (req, ctx) => {
  const { job } = await ownJob(ctx, int(req.params.id));
  await sql`DELETE FROM jobs WHERE id = ${job.id}`;
  return { ok: true };
};

/** AI agent turns a one-line brief into a full job post. */
export const draft: Handler = async (req, ctx) => {
  const u = needCompany(ctx);
  const b = await body(req);
  const brief = str(b.brief, 1500);
  if (brief.length < 10) throw new HttpError(400, 'Describe the role in a sentence or two.');
  const [company] = await sql`SELECT * FROM companies WHERE id = ${u.company_id}`;
  return draftJob(u.id, brief, company, !!b.regenerate);
};

/** Applicants (people who applied) and AI-recommended candidates (who haven't). */
export const jobCandidates: Handler = async (req, ctx) => {
  const { job } = await ownJob(ctx, int(req.params.id));
  const all = await loadOpenCandidates();
  const apps = await sql`SELECT a.*, u.name, u.avatar_color FROM applications a JOIN users u ON u.id = a.user_id WHERE a.job_id = ${job.id}`;
  const invites = new Set((await sql`SELECT user_id FROM invites WHERE job_id = ${job.id}`).map((r: any) => r.user_id));
  const appliedIds = new Set(apps.map((a: any) => a.user_id));

  const applicants = await Promise.all(apps.map(async (a: any) => {
    const c = all.find((x) => x.user.id === a.user_id) || (await loadCandidate(a.user_id));
    return { ...candidateCard(c, job), application: { id: a.id, status: a.status, created_at: a.created_at, cover_letter: a.cover_letter, employer_note: a.employer_note, source: a.source } };
  }));
  applicants.sort((a, b) => b.match.score - a.match.score);

  const recommended = all
    .filter((c) => !appliedIds.has(c.user.id) && c.cv)
    .map((c) => ({ ...candidateCard(c, job), invited: invites.has(c.user.id) }))
    .filter((c) => c.match.score >= 25)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 12);

  return { job, applicants, recommended };
};

export const setStatus: Handler = async (req, ctx) => {
  const u = needCompany(ctx);
  const b = await body(req);
  const [app] = await sql`SELECT a.*, jb.company_id, jb.title, jb.id AS jid FROM applications a JOIN jobs jb ON jb.id = a.job_id WHERE a.id = ${int(req.params.id)}`;
  if (!app || app.company_id !== u.company_id) throw new HttpError(404, 'Application not found.');
  const status = b.status ?? app.status;
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
  const note = b.employer_note != null ? str(b.employer_note, 2000) : app.employer_note;
  await sql`UPDATE applications SET status = ${status}, employer_note = ${note}, updated_at = now() WHERE id = ${app.id}`;
  if (status !== app.status) {
    await sql`INSERT INTO application_events (application_id, status) VALUES (${app.id}, ${status})`;
    await notify(app.user_id, `${u.company_name} ${STATUS_TEXT[status]} ${app.title}`, `/jobs/${app.jid}`);
  }
  return { ok: true, status };
};

/** Full CV of a candidate, with match vs. one of the employer's jobs. Lets the candidate know their CV was viewed. */
export const viewCandidate: Handler = async (req, ctx) => {
  const u = needCompany(ctx);
  const c = await loadCandidate(int(req.params.id));
  if (!c.cv) throw new HttpError(404, 'This candidate has not created a CV yet.');
  const jobId = Number(ctx.url.searchParams.get('job')) || 0;
  let match: any = null, application: any = null;
  if (jobId) {
    const { job } = await ownJob(ctx, jobId);
    match = scoreMatch(c, job);
    [application] = await sql`SELECT id, status, cover_letter, employer_note, created_at FROM applications WHERE job_id = ${jobId} AND user_id = ${c.user.id}`;
  }
  const [recent] = await sql`SELECT 1 FROM notifications WHERE user_id = ${c.user.id} AND text = ${`${u.company_name} viewed your CV`} AND created_at > now() - interval '1 day'`;
  if (!recent) await notify(c.user.id, `${u.company_name} viewed your CV`, '/candidate');
  return { candidate: { id: c.user.id, name: c.user.name, avatar_color: c.user.avatar_color }, cv: c.cv, profile: { years_experience: c.profile.years_experience, location: c.profile.location }, match, application: application || null };
};

export const insight: Handler = async (req, ctx) => {
  const { u, job } = await ownJob(ctx, int(req.params.id));
  const b = await body(req);
  const c = await loadCandidate(int(req.params.userId));
  if (!c.cv) throw new HttpError(400, 'This candidate has no CV yet.');
  return fitInsight(u.id, 'employer', c.cv, job, scoreMatch(c, job), !!b.regenerate);
};

export const invite: Handler = async (req, ctx) => {
  const { u, job } = await ownJob(ctx, int(req.params.id));
  const b = await body(req);
  const userId = int(req.params.userId);
  await loadCandidate(userId);
  const message = str(b.message, 600) || `Hi! We think you'd be a great fit for ${job.title} at ${u.company_name}. We'd love to see your application.`;
  const [row] = await sql`INSERT INTO invites (job_id, user_id, message) VALUES (${job.id}, ${userId}, ${message}) ON CONFLICT DO NOTHING RETURNING 1`;
  if (row) await notify(userId, `${u.company_name} invited you to apply for ${job.title}`, `/jobs/${job.id}`);
  return { ok: true };
};

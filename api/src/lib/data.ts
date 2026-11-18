// Shared loaders and serializers used by several routes.
import { sql } from '../db/client';
import { HttpError } from './http';
import { scoreMatch, type Profile } from './match';

export type Candidate = { user: { id: number; name: string; email: string; avatar_color: string }; profile: Profile & Record<string, any>; cv: any | null };

const num = (v: any) => (v == null ? v : Number(v));

export function cleanProfile(row: any): Profile & Record<string, any> {
  if (!row) return {};
  return { ...row, years_experience: num(row.years_experience) };
}

export async function loadCandidate(userId: number): Promise<Candidate> {
  const [user] = await sql`SELECT id, name, email, avatar_color FROM users WHERE id = ${userId} AND role = 'candidate'`;
  if (!user) throw new HttpError(404, 'Candidate not found.');
  const [profile] = await sql`SELECT * FROM profiles WHERE user_id = ${userId}`;
  const [cv] = await sql`SELECT content FROM cvs WHERE user_id = ${userId}`;
  return { user, profile: cleanProfile(profile), cv: cv?.content ?? null };
}

/** All candidates who are open to work, for employer-side recommendations. */
export async function loadOpenCandidates(): Promise<Candidate[]> {
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.avatar_color, p.*, c.content AS cv
    FROM users u JOIN profiles p ON p.user_id = u.id LEFT JOIN cvs c ON c.user_id = u.id
    WHERE u.role = 'candidate' AND p.open_to_work`;
  return rows.map((r: any) => ({
    user: { id: r.id, name: r.name, email: r.email, avatar_color: r.avatar_color },
    profile: cleanProfile(r),
    cv: r.cv ?? null,
  }));
}

export async function loadJobs(opts: { companyId?: number; openOnly?: boolean } = {}) {
  const rows = await sql`
    SELECT j.*, c.name AS company_name, c.color AS company_color, c.industry AS company_industry,
           c.location AS company_location, c.owner_id AS employer_id,
           (SELECT count(*)::int FROM applications a WHERE a.job_id = j.id) AS applicants,
           (SELECT count(*)::int FROM applications a WHERE a.job_id = j.id AND a.created_at > now() - interval '1 day') AS applicants_today
    FROM jobs j JOIN companies c ON c.id = j.company_id
    ORDER BY j.created_at DESC`;
  return rows
    .filter((r: any) => (!opts.openOnly || r.status === 'open') && (!opts.companyId || r.company_id === opts.companyId))
    .map((r: any) => ({ ...serializeJob(r), applicants_today: r.applicants_today }));
}

export function serializeJob(r: any) {
  return {
    id: r.id, title: r.title, location: r.location, remote: r.remote, type: r.type, level: r.level,
    salary_min: r.salary_min, salary_max: r.salary_max, currency: r.currency,
    description: r.description, responsibilities: r.responsibilities, requirements: r.requirements, nice_to_have: r.nice_to_have,
    status: r.status, views: r.views, created_at: r.created_at, applicants: r.applicants ?? 0,
    company: { id: r.company_id, name: r.company_name, color: r.company_color, industry: r.company_industry, location: r.company_location },
    employer_id: r.employer_id,
  };
}

export async function loadJob(id: number) {
  const [row] = await sql`
    SELECT j.*, c.name AS company_name, c.color AS company_color, c.industry AS company_industry,
           c.location AS company_location, c.owner_id AS employer_id, c.about AS company_about, c.size AS company_size, c.website AS company_website,
           (SELECT count(*)::int FROM applications a WHERE a.job_id = j.id) AS applicants
    FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ${id}`;
  if (!row) throw new HttpError(404, 'Job not found.');
  const job = serializeJob(row);
  return { ...job, company: { ...job.company, about: row.company_about, size: row.company_size, website: row.company_website } };
}

export function candidateCard(c: Candidate, job: any) {
  const m = scoreMatch(c, job);
  return {
    id: c.user.id, name: c.user.name, avatar_color: c.user.avatar_color,
    headline: c.cv?.headline || c.profile.desired_role || '', location: c.profile.location,
    years_experience: c.profile.years_experience, has_cv: !!c.cv,
    match: m,
  };
}

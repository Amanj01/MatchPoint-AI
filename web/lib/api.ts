export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data as T;
}

export type User = { id: number; email: string; name: string; role: 'candidate' | 'employer'; avatar_color: string; company_id: number | null; company_name: string | null };

export type Match = {
  score: number; label: string;
  breakdown: { skills: number; text: number; level: number };
  matched: string[]; partial: string[]; missing: string[]; matchedNice: string[]; missingNice: string[]; reasons: string[];
};

export type Job = {
  id: number; title: string; location: string; remote: boolean; type: string; level: string;
  salary_min: number | null; salary_max: number | null; currency: string;
  description: string; responsibilities: string[]; requirements: string[]; nice_to_have: string[];
  status: 'open' | 'closed'; views: number; created_at: string; applicants: number; applicants_today?: number;
  company: { id: number; name: string; color: string; industry: string; location: string; about?: string; size?: string; website?: string };
  match?: Match; applied?: boolean; saved?: boolean;
};

export type CV = {
  name: string; headline: string; summary: string;
  contact: { email?: string; phone?: string; location?: string; links?: string };
  strengths: string[]; skills: { category: string; items: string[] }[];
  experience: { title: string; company: string; period: string; bullets: string[] }[];
  education: { degree: string; school: string; period: string; details: string }[];
  projects: { name: string; description: string; tech: string[] }[];
  languages: string[]; keywords: string[];
};

export type Insight = { summary: string; strengths: string[]; concerns: string[]; questions: string[]; tips: string[]; _ai?: { mode: string; cached: boolean } };

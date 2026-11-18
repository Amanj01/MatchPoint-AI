export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Req = Request & { params: Record<string, string> };
export type Handler = (req: Req, ctx: Ctx) => Promise<Response | unknown> | Response | unknown;
export type Ctx = { user: SessionUser | null; url: URL; setCookie?: string };
export type SessionUser = { id: number; email: string; name: string; role: 'candidate' | 'employer'; avatar_color: string; avatar_url: string | null; company_id: number | null; company_name: string | null };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
}

export async function body<T = any>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}

export function int(v: unknown, name = 'id') {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}.`);
  return n;
}

export function str(v: unknown, max = 5000) {
  return String(v ?? '').trim().slice(0, max);
}

export function strList(v: unknown, max = 40): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => str(s, 200)).filter(Boolean).slice(0, max);
}

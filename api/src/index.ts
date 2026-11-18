import { loadUser } from './lib/auth';
import { HttpError, json, type Ctx, type Handler } from './lib/http';
import * as auth from './routes/auth';
import * as candidate from './routes/candidate';
import * as employer from './routes/employer';
import * as jobs from './routes/jobs';
import * as pub from './routes/public';

/** Wraps a handler: loads the session user, turns return values into JSON, and errors into clean messages. */
const h = (fn: Handler) => async (req: any) => {
  const ctx: Ctx = { user: null, url: new URL(req.url) };
  try {
    ctx.user = await loadUser(req);
    const out = await fn(req, ctx);
    const res = out instanceof Response ? out : json(out ?? { ok: true });
    if (ctx.setCookie) res.headers.append('set-cookie', ctx.setCookie);
    return res;
  } catch (err: any) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(`[${req.method} ${ctx.url.pathname}]`, err);
    return json({ error: 'Something went wrong on our side.' }, 500);
  }
};

const port = Number(process.env.PORT || 4000);

const server = Bun.serve({
  port,
  routes: {
    '/api/health': { GET: () => json({ ok: true }) },

    '/api/auth/register': { POST: h(auth.register) },
    '/api/auth/login': { POST: h(auth.login) },
    '/api/auth/logout': { POST: h(auth.logout) },
    '/api/auth/me': { GET: h(auth.me) },

    '/api/stats': { GET: h(pub.stats) },
    '/api/activity': { GET: h(pub.activity) },
    '/api/companies': { GET: h(pub.companies) },
    '/api/ai/status': { GET: h(pub.ai) },
    '/api/notifications': { GET: h(pub.notifications) },
    '/api/notifications/read': { POST: h(pub.readNotifications) },

    '/api/jobs': { GET: h(jobs.list) },
    '/api/jobs/:id': { GET: h(jobs.detail) },
    '/api/jobs/:id/apply': { POST: h(jobs.apply), DELETE: h(jobs.withdraw) },
    '/api/jobs/:id/save': { POST: h(jobs.toggleSave) },
    '/api/jobs/:id/cover-letter': { POST: h(jobs.writeCoverLetter) },
    '/api/jobs/:id/insight': { POST: h(jobs.insight) },

    '/api/me/profile': { GET: h(candidate.getProfile), PUT: h(candidate.saveProfile) },
    '/api/me/cv': { GET: h(candidate.getCv), PATCH: h(candidate.updateCv) },
    '/api/me/cv/generate': { POST: h(candidate.generate) },
    '/api/me/dashboard': { GET: h(candidate.dashboard) },
    '/api/me/applications': { GET: h(candidate.applications) },
    '/api/me/saved': { GET: h(candidate.saved) },

    '/api/employer/dashboard': { GET: h(employer.dashboard) },
    '/api/employer/company': { PUT: h(employer.saveCompany) },
    '/api/employer/jobs': { POST: h(employer.createJob) },
    '/api/employer/jobs/draft': { POST: h(employer.draft) },
    '/api/employer/jobs/:id': { PUT: h(employer.updateJob), DELETE: h(employer.deleteJob) },
    '/api/employer/jobs/:id/candidates': { GET: h(employer.jobCandidates) },
    '/api/employer/jobs/:id/insight/:userId': { POST: h(employer.insight) },
    '/api/employer/jobs/:id/invite/:userId': { POST: h(employer.invite) },
    '/api/employer/applications/:id': { PATCH: h(employer.setStatus) },
    '/api/employer/candidates/:id': { GET: h(employer.viewCandidate) },
  },
  fetch: () => json({ error: 'Not found' }, 404),
});

console.log(`MatchPoint API on http://localhost:${server.port} (AI mode: ${process.env.AI_MODE || 'mock'})`);

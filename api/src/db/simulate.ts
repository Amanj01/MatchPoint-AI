// Live demo mode: every few seconds a seeded candidate applies somewhere or an employer moves someone forward.
// Great for presentations: dashboards, notifications and the landing-page feed update on their own.
// Usage: bun run simulate   (Ctrl+C to stop). Never touches the two demo accounts' own actions.
import { sql } from './client';
import { loadCandidate, loadJob } from '../lib/data';
import { scoreMatch } from '../lib/match';

const NEXT: Record<string, string> = { applied: 'shortlisted', shortlisted: 'interview', interview: 'offer' };
const every = Number(process.argv[2] || 8) * 1000;

async function tick() {
  if (Math.random() < 0.65) {
    const [pair] = await sql`
      SELECT u.id AS user_id, jb.id AS job_id FROM users u JOIN cvs c ON c.user_id = u.id CROSS JOIN jobs jb
      WHERE u.role = 'candidate' AND u.email <> 'candidate@matchpoint.demo' AND jb.status = 'open'
        AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id AND a.job_id = jb.id)
      ORDER BY random() LIMIT 1`;
    if (!pair) return;
    const c = await loadCandidate(pair.user_id);
    const job = await loadJob(pair.job_id);
    const m = scoreMatch(c, job);
    if (m.score < 35) return;
    const [a] = await sql`INSERT INTO applications (job_id, user_id, match_score, cover_letter) VALUES (${job.id}, ${c.user.id}, ${m.score}, '') RETURNING id`;
    await sql`INSERT INTO application_events (application_id, status) VALUES (${a.id}, 'applied')`;
    await sql`INSERT INTO notifications (user_id, text, link) VALUES (${job.employer_id}, ${`${c.user.name} applied to ${job.title} (match ${m.score}%)`}, ${`/employer/jobs/${job.id}`})`;
    console.log(`+ ${c.user.name} applied to ${job.title} @ ${job.company.name} (${m.score}%)`);
  } else {
    const [a] = await sql`SELECT a.id, a.status, a.user_id, jb.title, jb.id AS job_id, co.name AS company FROM applications a
      JOIN jobs jb ON jb.id = a.job_id JOIN companies co ON co.id = jb.company_id
      WHERE a.status IN ('applied','shortlisted','interview') AND a.match_score >= 55 AND co.owner_id <> (SELECT id FROM users WHERE email = 'hr@nova.demo')
      ORDER BY random() LIMIT 1`;
    if (!a) return;
    const next = NEXT[a.status];
    await sql`UPDATE applications SET status = ${next}, updated_at = now() WHERE id = ${a.id}`;
    await sql`INSERT INTO application_events (application_id, status) VALUES (${a.id}, ${next})`;
    console.log(`> ${a.company} moved an applicant for ${a.title} to ${next}`);
  }
}

console.log(`Simulating live activity every ${every / 1000}s. Ctrl+C to stop.`);
while (true) {
  try { await tick(); } catch (e) { console.error(e); }
  await Bun.sleep(every * (0.6 + Math.random() * 0.8));
}

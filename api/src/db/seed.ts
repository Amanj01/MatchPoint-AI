// Fills the database with realistic demo data. Timestamps are relative to "now" so the site always looks active.
// Usage: bun run seed   (wipes existing data)
import { sql, j } from './client';
import { mockCV } from '../lib/ai';
import { scoreMatch } from '../lib/match';
import { ARCHETYPES, CITIES, COMPANIES, COMPANY_COVERS, FIRST, JOBS, LAST, SCHOOLS, portraitFor } from './seed-data';

let seed = 20261118;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const sample = <T>(a: readonly T[], n: number) => [...a].sort(() => rand() - 0.5).slice(0, n);
const ago = (days: number) => new Date(Date.now() - days * 86400_000);
const COLORS = ['#4f46e5', '#0f766e', '#b45309', '#be123c', '#7c3aed', '#0369a1', '#15803d', '#c2410c', '#db2777', '#475569'];

export const DEMO_PASSWORD = 'demo1234';

const schema = await Bun.file(new URL('./schema.sql', import.meta.url)).text();
await sql.unsafe(schema).simple();
await sql.unsafe(`TRUNCATE users, sessions, companies, profiles, cvs, jobs, applications, application_events, invites, saved_jobs, notifications, ai_usage, ai_cache RESTART IDENTITY CASCADE`).simple();

const hash = await Bun.password.hash(DEMO_PASSWORD, { algorithm: 'bcrypt', cost: 10 });

// ---- Employers, companies, jobs
const recruiterNames = ['Dlshad Omer', 'Shilan Aziz', 'Karzan Rashid', 'Bushra Salih', 'Hemin Faraj', 'Noor Jalal', 'Rebin Qadir', 'Chiman Nouri', 'Huda Sabir', 'Sirwan Hamid'];
const companyId: Record<string, number> = {};
const companyOwner: Record<string, number> = {};
for (const [i, c] of COMPANIES.entries()) {
  const [u] = await sql`INSERT INTO users (email, password_hash, name, role, avatar_color, avatar_url, created_at)
    VALUES (${`hr@${c.key}.demo`}, ${hash}, ${recruiterNames[i]}, 'employer', ${c.color}, ${portraitFor(recruiterNames[i])}, ${ago(60 + i)}) RETURNING id`;
  const [row] = await sql`INSERT INTO companies (owner_id, name, industry, size, location, website, about, color, cover_url, created_at)
    VALUES (${u.id}, ${c.name}, ${c.industry}, ${c.size}, ${c.location}, ${c.website}, ${c.about}, ${c.color}, ${COMPANY_COVERS[c.key]}, ${ago(60 + i)}) RETURNING id`;
  companyId[c.key] = row.id;
  companyOwner[c.key] = u.id;
}

const jobs: any[] = [];
for (const [i, jb] of JOBS.entries()) {
  const co = COMPANIES.find((c) => c.key === jb.co)!;
  // A few jobs posted in the last day or so ("new"), the rest spread over the past ~4 weeks.
  const created = ago([3, 10, 16, 24].includes(i) ? 0.1 + rand() * 1.2 : i < 3 ? 14 + i * 4 : 3 + rand() * 24);
  const [row] = await sql`INSERT INTO jobs (company_id, title, location, remote, type, level, salary_min, salary_max, description, responsibilities, requirements, nice_to_have, views, created_at, status)
    VALUES (${companyId[jb.co]}, ${jb.title}, ${jb.location || co.location}, ${!!jb.remote}, ${jb.type || 'Full-time'}, ${jb.level},
            ${jb.sal?.[0] ?? null}, ${jb.sal?.[1] ?? null}, ${jb.desc}, ${j(jb.resp)}::jsonb, ${j(jb.req)}::jsonb, ${j(jb.nice)}::jsonb,
            ${Math.floor(40 + rand() * 600)}, ${created}, ${i === JOBS.length - 1 ? 'closed' : 'open'}) RETURNING id`;
  jobs.push({ ...jb, id: row.id, created, employer: companyOwner[jb.co], company: co, requirements: jb.req, nice_to_have: jb.nice, description: jb.desc, responsibilities: jb.resp });
}

// ---- Candidates
type Cand = { id: number; name: string; profile: any; cv: any; demo?: boolean };
const cands: Cand[] = [];

async function addCandidate(name: string, email: string, profile: any, withCv: boolean, createdDaysAgo: number, demo = false) {
  const [u] = await sql`INSERT INTO users (email, password_hash, name, role, avatar_color, avatar_url, created_at)
    VALUES (${email}, ${hash}, ${name}, 'candidate', ${pick(COLORS)}, ${portraitFor(name)}, ${ago(createdDaysAgo)}) RETURNING id`;
  await sql`INSERT INTO profiles (user_id, headline, desired_role, location, phone, links, passion, years_experience, skills, experience, education, projects, languages, open_to_work, updated_at)
    VALUES (${u.id}, '', ${profile.desired_role}, ${profile.location}, ${profile.phone}, ${profile.links}, ${profile.passion}, ${profile.years_experience},
            ${j(profile.skills)}::jsonb, ${j(profile.experience)}::jsonb, ${j(profile.education)}::jsonb, ${j(profile.projects)}::jsonb, ${j(profile.languages)}::jsonb,
            ${profile.open_to_work ?? true}, ${ago(createdDaysAgo * rand())})`;
  let cv: any = null;
  if (withCv) {
    cv = { ...mockCV(profile), name, contact: { email, phone: profile.phone, location: profile.location, links: profile.links } };
    await sql`INSERT INTO cvs (user_id, content, template, ai_mode, updated_at)
      VALUES (${u.id}, ${j(cv)}::jsonb, ${pick(['modern', 'modern', 'classic', 'compact'])}, 'mock', ${ago(Math.min(createdDaysAgo, rand() * 10))})`;
  }
  cands.push({ id: u.id, name, profile, cv, demo });
  return u.id;
}

// Demo candidate with a hand-written profile
const demoProfile = {
  desired_role: 'Frontend Developer', location: 'Erbil', phone: '+964 750 000 0000', links: 'github.com/aram-demo · aram.dev',
  passion: 'I love building interfaces that feel fast and simple, especially for people who are new to technology. I want to work on products that help small businesses in Kurdistan go digital.',
  years_experience: 1.5,
  skills: ['React', 'JavaScript', 'TypeScript', 'CSS', 'HTML', 'Git', 'Figma', 'Tailwind', 'Communication'],
  experience: [
    { title: 'Junior Frontend Developer', company: 'Bloom Web Studio', start: 'Mar 2025', end: '', description: 'Built responsive React pages for 12 client websites. Cut page load time by 40% by lazy-loading images and splitting bundles. Worked with designers to turn Figma files into reusable components.' },
    { title: 'Frontend Intern', company: 'Kurd Digital', start: 'Jun 2024', end: 'Sep 2024', description: 'Added dark mode and keyboard shortcuts to an internal React dashboard used by 30 staff.' },
  ],
  education: [{ degree: 'BSc Computer Science', school: 'University of Kurdistan Hewlêr', start: '2020', end: '2024', details: 'Graduation project: accessible bus tracking app. GPA 3.6' }],
  projects: [
    { name: 'BusTrack', description: 'Live bus tracker for Erbil city routes with a React map UI and 600 weekly users.', tech: ['React', 'Leaflet', 'Firebase'] },
    { name: 'Shop Setup Kit', description: 'Free Next.js template that helps local shops publish a catalogue in an hour.', tech: ['Next.js', 'Tailwind'] },
  ],
  languages: ['Kurdish (native)', 'Arabic', 'English (fluent)'],
};
await addCandidate('Aram Hassan', 'candidate@matchpoint.demo', demoProfile, true, 30, true);

const usedNames = new Set(['Aram Hassan']);
for (let i = 0; i < 40; i++) {
  const a = ARCHETYPES[i % ARCHETYPES.length];
  let name = '';
  do name = `${pick(FIRST)} ${pick(LAST)}`; while (usedNames.has(name));
  usedNames.add(name);
  const years = Math.round(pick([0, 0.5, 1, 1.5, 2, 3, 4, 6, 8]) * 10) / 10;
  const skills = [...sample(a.core, Math.max(2, a.core.length - Math.floor(rand() * 2))), ...sample(a.extra, 2 + Math.floor(rand() * 3))];
  const start = 2025 - Math.ceil(years);
  const experience = years > 0
    ? sample(a.duties, years >= 3 ? 2 : 1).map((d, k) => ({ title: k === 0 ? a.titles[0] : a.titles[1] ?? a.titles[0], company: pick(a.companies), start: String(start + (k === 0 ? 1 : 0)), end: k === 0 ? '' : String(start + 1), description: d }))
    : [{ title: a.titles[a.titles.length - 1], company: pick(a.companies), start: 'Jun 2025', end: 'Sep 2025', description: a.duties[0].split('. ')[0] + '.' }];
  const gradYear = 2025 - Math.floor(years) - Math.floor(rand() * 2);
  const profile = {
    desired_role: a.role, location: pick(CITIES), phone: `+964 7${50 + Math.floor(rand() * 30)} ${100 + Math.floor(rand() * 899)} ${1000 + Math.floor(rand() * 8999)}`,
    links: `linkedin.com/in/${name.toLowerCase().replace(' ', '-')}`,
    passion: pick(a.passions), years_experience: years, skills,
    experience, education: [{ degree: a.degree, school: pick(SCHOOLS), start: String(gradYear - 4), end: String(gradYear), details: '' }],
    projects: sample(a.projects, 1), languages: sample(['Kurdish (native)', 'Arabic', 'English', 'Turkish', 'Persian'], 2 + Math.floor(rand() * 2)),
    open_to_work: rand() > 0.08,
  };
  const email = `${name.toLowerCase().replace(' ', '.')}@mail.demo`;
  await addCandidate(name, email, profile, rand() > 0.12, 2 + rand() * 50);
}

// ---- Applications with realistic pipelines
const FLOW = ['applied', 'shortlisted', 'interview', 'offer', 'hired'];
let appCount = 0;
for (const c of cands) {
  if (!c.cv) continue;
  const scored = jobs.filter((jb) => jb.created < new Date()).map((jb) => ({ jb, m: scoreMatch(c, jb) })).sort((x, y) => y.m.score - x.m.score);
  const howMany = c.demo ? 4 : 1 + Math.floor(rand() * 4);
  for (const { jb, m } of scored.slice(0, howMany + 2)) {
    if (appCount && !c.demo && (m.score < 38 || rand() < 0.3)) continue;
    if (c.demo && jb.co === 'nova' && jb.level === 'junior' && jb.title.startsWith('Frontend')) continue; // leave the best one for the live demo
    const jobAge = (Date.now() - jb.created.getTime()) / 86400_000;
    const appliedAgo = jobAge * rand() ** 2 * 0.95; // skewed towards recent days
    // Further along the pipeline for older, stronger applications
    let stage = 0;
    const r = rand();
    if (appliedAgo > 1 && m.score > 45) stage = r < 0.35 ? 0 : r < 0.65 ? 1 : r < 0.85 ? 2 : r < 0.95 ? 3 : 4;
    else if (appliedAgo > 1) stage = r < 0.6 ? 0 : 1;
    const rejected = appliedAgo > 2 && m.score < 50 && rand() < 0.45;
    const status = rejected ? 'rejected' : FLOW[stage];
    const steps = rejected ? ['applied', 'rejected'] : FLOW.slice(0, stage + 1);
    const created = ago(appliedAgo);
    const updated = ago(appliedAgo * (steps.length > 1 ? rand() * 0.6 : 1));
    const letter = `Dear ${jb.company.name} team,\n\nI'm excited to apply for ${jb.title}. ${c.cv.summary.split('. ')[0]}.\n\nBest regards,\n${c.name}`;
    const [a] = await sql`INSERT INTO applications (job_id, user_id, cover_letter, status, match_score, created_at, updated_at)
      VALUES (${jb.id}, ${c.id}, ${letter}, ${status}, ${m.score}, ${created}, ${updated}) RETURNING id`;
    for (const [k, s] of steps.entries()) {
      const at = new Date(created.getTime() + ((updated.getTime() - created.getTime()) * k) / Math.max(1, steps.length - 1));
      await sql`INSERT INTO application_events (application_id, status, created_at) VALUES (${a.id}, ${s}, ${at})`;
    }
    if (k_notify(c, status)) await sql`INSERT INTO notifications (user_id, text, link, read, created_at)
      VALUES (${c.id}, ${`${jb.company.name} ${status === 'interview' ? 'invited you to interview for' : status === 'shortlisted' ? 'shortlisted you for' : status === 'offer' ? 'made you an offer for' : status === 'rejected' ? 'decided not to move forward with' : 'received your application for'} ${jb.title}`}, ${`/jobs/${jb.id}`}, ${rand() < 0.4}, ${updated})`;
    if (jb.co === 'nova') await sql`INSERT INTO notifications (user_id, text, link, read, created_at)
      VALUES (${jb.employer}, ${`${c.name} applied to ${jb.title} (match ${m.score}%)`}, ${`/employer/jobs/${jb.id}`}, ${appliedAgo > 1}, ${created})`;
    appCount++;
  }
}
function k_notify(c: Cand, status: string) { return c.demo || status !== 'applied'; }

// ---- Invites and saved jobs for the demo candidate
const demo = cands.find((c) => c.demo)!;
const novaFrontend = jobs.find((jb) => jb.co === 'nova' && jb.title.startsWith('Frontend'))!;
const eduNext = jobs.find((jb) => jb.co === 'edu' && jb.title.startsWith('Next'))!;
for (const jb of [novaFrontend, eduNext]) {
  await sql`INSERT INTO invites (job_id, user_id, message, created_at) VALUES (${jb.id}, ${demo.id}, ${`Hi Aram! Your BusTrack project caught our eye. We'd love to see your application for ${jb.title}.`}, ${ago(0.15)}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO notifications (user_id, text, link, created_at) VALUES (${demo.id}, ${`${jb.company.name} invited you to apply for ${jb.title}`}, ${`/jobs/${jb.id}`}, ${ago(0.15)})`;
}
await sql`INSERT INTO notifications (user_id, text, link, created_at) VALUES (${demo.id}, 'Pixel Bazaar viewed your CV', '/candidate', ${ago(0.05)})`;
await sql`INSERT INTO saved_jobs (user_id, job_id) VALUES (${demo.id}, ${jobs.find((jb) => jb.title.startsWith('Senior React'))!.id})`;

const [counts] = await sql`SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM jobs)::int AS jobs,
  (SELECT count(*) FROM applications)::int AS applications, (SELECT count(*) FROM cvs)::int AS cvs`;
console.log('Seeded:', counts);
console.log(`Demo logins (password "${DEMO_PASSWORD}"):\n  candidate: candidate@matchpoint.demo\n  employer:  hr@nova.demo`);
await sql.close();

// Local, explainable matching engine. Runs on every page view at zero AI cost.
// Score = 60% skills + 25% text similarity + 15% seniority fit.

const ALIASES: Record<string, string> = {
  js: 'javascript', 'java script': 'javascript', es6: 'javascript',
  ts: 'typescript',
  reactjs: 'react', 'react.js': 'react',
  node: 'node.js', nodejs: 'node.js',
  'express.js': 'express', expressjs: 'express',
  vuejs: 'vue', 'vue.js': 'vue',
  nextjs: 'next.js', next: 'next.js',
  py: 'python', python3: 'python',
  postgres: 'postgresql', psql: 'postgresql',
  mongo: 'mongodb',
  ml: 'machine learning', ai: 'artificial intelligence',
  dl: 'deep learning', nlp: 'natural language processing',
  'scikit learn': 'scikit-learn', sklearn: 'scikit-learn',
  k8s: 'kubernetes', gcp: 'google cloud', 'amazon web services': 'aws',
  'c sharp': 'c#', csharp: 'c#', cpp: 'c++',
  'ms excel': 'excel', 'microsoft excel': 'excel',
  'power bi': 'powerbi', ux: 'ux design', ui: 'ui design',
  'communication skills': 'communication', teamwork: 'team work', 'problem-solving': 'problem solving',
  'rest api': 'rest', 'restful apis': 'rest', 'rest apis': 'rest',
  cicd: 'ci/cd',
};

export const SKILL_CATEGORIES: Record<string, string[]> = {
  'Programming': ['javascript', 'typescript', 'html', 'css', 'python', 'java', 'c#', 'c++', 'go', 'rust', 'php', 'kotlin', 'swift', 'sql', 'r', 'dart'],
  'Frameworks': ['react', 'vue', 'angular', 'next.js', 'node.js', 'express', 'django', 'flask', 'fastapi', 'spring', 'flutter', 'react native', '.net', 'tailwind', 'laravel', 'rest', 'graphql'],
  'Data & AI': ['machine learning', 'deep learning', 'artificial intelligence', 'natural language processing', 'data analysis', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'statistics', 'powerbi', 'tableau', 'excel', 'computer vision', 'llm'],
  'Cloud & DevOps': ['aws', 'azure', 'google cloud', 'docker', 'kubernetes', 'ci/cd', 'linux', 'git', 'terraform', 'networking', 'cybersecurity'],
  'Databases': ['postgresql', 'mysql', 'mongodb', 'sqlite', 'redis', 'firebase'],
  'Design': ['figma', 'ux design', 'ui design', 'photoshop', 'illustrator', 'prototyping', 'user research', 'adobe xd'],
  'Business': ['marketing', 'seo', 'sales', 'project management', 'agile', 'scrum', 'accounting', 'finance', 'content writing', 'social media', 'customer service', 'crm'],
  'Soft skills': ['communication', 'team work', 'leadership', 'problem solving', 'time management', 'critical thinking', 'creativity', 'presentation'],
};

const LEVELS: Record<string, [number, number]> = { intern: [0, 1], junior: [0, 2], mid: [2, 5], senior: [5, 40] };

const STOP = new Set('a an and are as at be by for from has have i in is it its of on or our that the to was we were will with you your this they their them who what when where how can able also into about over more most such than then these those very via using use used work working team role job looking strong good great new'.split(' '));

export function normalizeSkill(s: string) {
  const k = String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.]$/, '');
  return ALIASES[k] || k;
}

export function categorize(skills: string[]) {
  const groups: Record<string, string[]> = {};
  for (const raw of skills) {
    const n = normalizeSkill(raw);
    const cat = Object.entries(SKILL_CATEGORIES).find(([, list]) => list.includes(n))?.[0] || 'Other';
    (groups[cat] ||= []).push(raw);
  }
  return Object.entries(groups).map(([category, items]) => ({ category, items }));
}

function tokens(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function cosine(a: string[], b: string[]) {
  const fa = new Map<string, number>(), fb = new Map<string, number>();
  for (const t of a) fa.set(t, (fa.get(t) || 0) + 1);
  for (const t of b) fb.set(t, (fb.get(t) || 0) + 1);
  let dot = 0, na = 0, nb = 0;
  for (const [t, v] of fa) { na += v * v; if (fb.has(t)) dot += v * fb.get(t)!; }
  for (const v of fb.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export type Profile = {
  desired_role?: string; headline?: string; passion?: string; years_experience?: number | string;
  skills?: string[]; experience?: any[]; education?: any[]; projects?: any[]; languages?: string[];
};
export type Job = { title: string; description?: string; level?: string; requirements?: string[]; nice_to_have?: string[]; responsibilities?: string[] };

export function candidateFacts(profile: Profile = {}, cv: any = null) {
  const skills = new Set((profile.skills || []).map(normalizeSkill));
  if (cv?.skills) for (const g of cv.skills) for (const s of g.items || []) skills.add(normalizeSkill(s));
  const textParts = [
    profile.desired_role, profile.headline, profile.passion,
    ...(profile.experience || []).flatMap((e) => [e.title, e.company, e.description]),
    ...(profile.projects || []).flatMap((p) => [p.name, p.description, (p.tech || []).join(' ')]),
    ...(profile.education || []).flatMap((e) => [e.degree, e.school, e.details]),
    cv?.summary, cv?.headline,
    ...(cv?.experience || []).flatMap((e: any) => [e.title, ...(e.bullets || [])]),
  ];
  return { skills, text: textParts.filter(Boolean).join(' '), years: Number(profile.years_experience) || 0 };
}

export type MatchResult = {
  score: number;
  label: string;
  breakdown: { skills: number; text: number; level: number };
  matched: string[]; partial: string[]; missing: string[]; matchedNice: string[]; missingNice: string[];
  reasons: string[];
};

export function scoreMatch(candidate: { profile: Profile; cv?: any }, job: Job): MatchResult {
  const c = candidateFacts(candidate.profile, candidate.cv);
  const required = (job.requirements || []).map((s) => ({ raw: s, n: normalizeSkill(s) }));
  const nice = (job.nice_to_have || []).map((s) => ({ raw: s, n: normalizeSkill(s) }));
  const jobText = [job.title, job.description, ...(job.responsibilities || []), ...(job.requirements || []), ...(job.nice_to_have || [])].join(' ');
  const lowerText = ` ${c.text.toLowerCase().replace(/[,.;:()]/g, ' ')} `;
  const mentioned = (n: string) => n.length > 2 && lowerText.includes(` ${n} `);

  const matched: string[] = [], partial: string[] = [], missing: string[] = [], missingNice: string[] = [], matchedNice: string[] = [];
  let got = 0, total = 0;
  for (const s of required) {
    total += 1;
    if (c.skills.has(s.n)) { got += 1; matched.push(s.raw); }
    else if (mentioned(s.n)) { got += 0.6; partial.push(s.raw); }
    else missing.push(s.raw);
  }
  for (const s of nice) {
    total += 0.5;
    if (c.skills.has(s.n)) { got += 0.5; matchedNice.push(s.raw); }
    else if (mentioned(s.n)) { got += 0.3; matchedNice.push(s.raw); }
    else missingNice.push(s.raw);
  }
  const skillScore = total ? got / total : 0.5;
  const textScore = Math.min(1, cosine(tokens(c.text + ' ' + [...c.skills].join(' ')), tokens(jobText)) * 2.5);

  const [lo, hi] = LEVELS[job.level || 'junior'] || LEVELS.junior;
  let levelScore = 1;
  if (c.years < lo) levelScore = Math.max(0, 1 - (lo - c.years) / 3);
  else if (c.years > hi) levelScore = Math.max(0.5, 1 - (c.years - hi) / 8); // over-qualified is a smaller penalty

  const score = Math.round(100 * (0.6 * skillScore + 0.25 * textScore + 0.15 * levelScore));

  const reasons: string[] = [];
  if (matched.length) reasons.push(`Has ${matched.length} of ${required.length} required skills`);
  if (partial.length) reasons.push(`Shows ${partial.join(', ')} in experience or projects`);
  if (matchedNice.length) reasons.push(`Bonus skills: ${matchedNice.join(', ')}`);
  if (levelScore >= 0.99) reasons.push(`Experience fits a ${job.level} role`);
  else if (c.years < lo) reasons.push(`Less experience than a typical ${job.level} hire`);
  if (missing.length) reasons.push(`Missing: ${missing.join(', ')}`);

  return {
    score,
    label: scoreLabel(score),
    breakdown: { skills: Math.round(skillScore * 100), text: Math.round(textScore * 100), level: Math.round(levelScore * 100) },
    matched, partial, missing, matchedNice, missingNice, reasons,
  };
}

export function scoreLabel(score: number) {
  if (score >= 75) return 'Excellent match';
  if (score >= 55) return 'Good match';
  if (score >= 35) return 'Partial match';
  return 'Low match';
}

/** How complete a profile is, with the next things to fill in. */
export function profileStrength(p: Profile, hasCv: boolean) {
  const checks: [boolean, string][] = [
    [!!p.desired_role, 'Add the role you want'],
    [!!p.passion && p.passion.length > 40, 'Describe your passion and goals (a few sentences)'],
    [(p.skills || []).length >= 5, 'List at least 5 skills'],
    [(p.experience || []).length > 0, 'Add work experience or internships'],
    [(p.education || []).length > 0, 'Add your education'],
    [(p.projects || []).length > 0, 'Add a project you are proud of'],
    [(p.languages || []).length > 0, 'Add the languages you speak'],
    [hasCv, 'Generate your CV with the AI agent'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { percent: Math.round((done / checks.length) * 100), todo: checks.filter(([ok]) => !ok).map(([, t]) => t) };
}

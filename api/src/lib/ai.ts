// The AI agent. Two modes:
//   AI_MODE=mock   -> deterministic, free, offline (default; used for development and demos)
//   AI_MODE=gemini -> real Gemini calls, with a per-user daily cap and a result cache
import { sql, j } from '../db/client';
import { HttpError } from './http';
import { categorize, type MatchResult, type Profile } from './match';

export const aiMode = () => ((process.env.AI_MODE || 'mock').toLowerCase() === 'gemini' ? 'gemini' : 'mock');
const DAILY_LIMIT = () => Number(process.env.AI_DAILY_LIMIT || 30);

export type AiMeta = { mode: 'mock' | 'gemini'; cached: boolean };

export async function aiStatus(userId?: number) {
  const [row] = userId
    ? await sql`SELECT count(*)::int AS n FROM ai_usage WHERE user_id = ${userId} AND mode = 'gemini' AND NOT cached AND created_at > now() - interval '1 day'`
    : [{ n: 0 }];
  return { mode: aiMode(), model: aiMode() === 'gemini' ? process.env.GEMINI_MODEL || 'gemini-2.5-flash' : 'mock', usedToday: row.n, dailyLimit: DAILY_LIMIT() };
}

export async function callGemini(prompt: string, maxTokens = 2048) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, 'AI_MODE=gemini but GEMINI_API_KEY is empty. Add the key to api/.env or switch to AI_MODE=mock.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }, // no paid "thinking" tokens
      },
    }),
  });
  if (!res.ok) throw new HttpError(502, `Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return { json: JSON.parse(cleaned), usage: data.usageMetadata || {} };
  } catch {
    throw new HttpError(502, 'Gemini returned text that was not valid JSON. Try again.');
  }
}

async function run<T>(opts: { kind: string; userId: number; input: unknown; fresh?: boolean; prompt: () => string; mock: () => T; maxTokens?: number }): Promise<T & { _ai: AiMeta }> {
  const mode = aiMode();
  const key = new Bun.CryptoHasher('sha256').update(`${opts.kind}|${mode}|${JSON.stringify(opts.input)}`).digest('hex');

  if (!opts.fresh) {
    const [hit] = await sql`SELECT result FROM ai_cache WHERE key = ${key}`;
    if (hit) {
      await sql`INSERT INTO ai_usage (user_id, kind, mode, cached) VALUES (${opts.userId}, ${opts.kind}, ${mode}, true)`;
      return { ...(hit.result as T), _ai: { mode, cached: true } };
    }
  }

  let result: T, tin = 0, tout = 0;
  if (mode === 'mock') {
    await Bun.sleep(350 + Math.random() * 400); // feels like an agent thinking
    result = opts.mock();
  } else {
    const { usedToday, dailyLimit } = await aiStatus(opts.userId);
    if (usedToday >= dailyLimit) throw new HttpError(429, `Daily AI limit reached (${dailyLimit}). Try again tomorrow.`);
    const out = await callGemini(opts.prompt(), opts.maxTokens);
    result = out.json as T;
    tin = out.usage.promptTokenCount || 0;
    tout = out.usage.candidatesTokenCount || 0;
  }
  await sql`INSERT INTO ai_cache (key, result) VALUES (${key}, ${j(result)}::jsonb) ON CONFLICT (key) DO UPDATE SET result = EXCLUDED.result, created_at = now()`;
  await sql`INSERT INTO ai_usage (user_id, kind, mode, tokens_in, tokens_out) VALUES (${opts.userId}, ${opts.kind}, ${mode}, ${tin}, ${tout})`;
  return { ...result, _ai: { mode, cached: false } };
}

// ---------------------------------------------------------------- CV writer

export type CV = {
  name: string; headline: string; summary: string;
  contact: { email?: string; phone?: string; location?: string; links?: string };
  strengths: string[];
  skills: { category: string; items: string[] }[];
  experience: { title: string; company: string; period: string; bullets: string[] }[];
  education: { degree: string; school: string; period: string; details: string }[];
  projects: { name: string; description: string; tech: string[] }[];
  languages: string[];
  keywords: string[];
};

const CV_SHAPE = `{"headline": string, "summary": string (3-4 sentences, first person implied, no "I"), "strengths": string[3] (short phrases), "skills": [{"category": string, "items": string[]}], "experience": [{"title": string, "company": string, "period": string, "bullets": string[2-4] (start with strong action verbs, quantify where the input allows)}], "education": [{"degree": string, "school": string, "period": string, "details": string}], "projects": [{"name": string, "description": string (1-2 sentences), "tech": string[]}], "languages": string[], "keywords": string[8] (ATS keywords for the desired role)}`;

export function generateCV(userId: number, person: { name: string; email: string }, p: Profile & Record<string, any>, fresh = false) {
  const input = { person, p };
  return run<CV>({
    kind: 'cv', userId, input, fresh, maxTokens: 3000,
    prompt: () => `You are an expert CV writer and career coach. Write a polished, ATS-friendly CV for this person.
Rules: use ONLY facts given below. Never invent employers, dates, degrees, numbers or skills. You may rephrase, group and polish.
Return JSON exactly in this shape: ${CV_SHAPE}

Person: ${JSON.stringify({ name: person.name, desired_role: p.desired_role, location: p.location, years_experience: p.years_experience, passion: p.passion, skills: p.skills, experience: p.experience, education: p.education, projects: p.projects, languages: p.languages })}`,
    mock: () => mockCV(p),
  }).then((cv) => ({
    ...cv,
    name: person.name,
    contact: { email: person.email, phone: p.phone, location: p.location, links: p.links },
  }));
}

const VERBS = ['Built', 'Delivered', 'Led', 'Improved', 'Designed', 'Developed', 'Supported', 'Created'];

function sentences(text = '') {
  return String(text).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim().replace(/[.]+$/, '')).filter((s) => s.length > 3);
}

function bulletize(text: string, i: number) {
  const parts = sentences(text);
  if (!parts.length) return [`${VERBS[i % VERBS.length]} day-to-day work as part of the team`];
  return parts.slice(0, 4).map((s, k) => {
    const first = s.split(' ')[0];
    const startsWithVerb = /ed$|^Led|^Built|^Ran|^Won|^Made/.test(first);
    const body = s.charAt(0).toLowerCase() + s.slice(1);
    return startsWithVerb ? s.charAt(0).toUpperCase() + s.slice(1) : `${VERBS[(i + k) % VERBS.length]}: ${body}`;
  });
}

export function mockCV(p: Profile & Record<string, any>): CV {
  const skills = p.skills || [];
  const role = p.desired_role || p.experience?.[0]?.title || 'Graduate';
  const years = Number(p.years_experience) || 0;
  const top = skills.slice(0, 4).join(', ');
  const passion = sentences(p.passion)[0];
  const exp = years >= 1 ? `${role} with ${years} year${years === 1 ? '' : 's'} of hands-on experience` : `Early-career ${role.toLowerCase()} with hands-on project experience`;
  const love = passion?.match(/^I (?:love|enjoy|like|am passionate about|am excited by)\s+(.*)$/i);
  const passionLine = !passion ? '' : love ? `Passionate about ${love[1]}.` : `${passion}.`;
  return {
    name: '', contact: {},
    headline: `${role}${top ? ` · ${skills.slice(0, 3).join(' · ')}` : ''}`,
    summary: [
      `${exp}${top ? ` in ${top}` : ''}.`,
      passionLine,
      p.projects?.length ? `Has shipped ${p.projects.length} project${p.projects.length > 1 ? 's' : ''}, including ${p.projects[0].name}.` : '',
      `Looking to grow as a ${role.toLowerCase()} in a team that values ownership and learning.`,
    ].filter(Boolean).join(' '),
    strengths: [
      skills[0] ? `Strong ${skills[0]} foundation` : 'Fast learner',
      p.projects?.length ? 'Ships real projects end to end' : 'Reliable team player',
      (p.languages || []).length > 1 ? `Works in ${(p.languages || []).length} languages` : 'Clear communicator',
    ],
    skills: categorize(skills),
    experience: (p.experience || []).map((e: any, i: number) => ({
      title: e.title, company: e.company, period: [e.start, e.end || 'Present'].filter(Boolean).join(' – '), bullets: bulletize(e.description, i),
    })),
    education: (p.education || []).map((e: any) => ({ degree: e.degree, school: e.school, period: [e.start, e.end].filter(Boolean).join(' – '), details: e.details || '' })),
    projects: (p.projects || []).map((pr: any) => ({ name: pr.name, description: pr.description, tech: pr.tech || [] })),
    languages: p.languages || [],
    keywords: [...new Set([role, ...skills])].slice(0, 8),
  };
}

// ---------------------------------------------------------------- Cover letter

export function coverLetter(userId: number, cv: CV, job: any, company: any, fresh = false) {
  return run<{ letter: string }>({
    kind: 'cover-letter', userId, input: { cv, jobId: job.id, title: job.title }, fresh, maxTokens: 900,
    prompt: () => `Write a concise, warm, specific cover letter (max 220 words, 3 short paragraphs) from this candidate for this job.
Use only facts in the CV. Mention 2-3 concrete matching skills or projects. No placeholders like [Name]. Sign with the candidate's name.
Return JSON: {"letter": string}
CV: ${JSON.stringify(cv)}
Job: ${JSON.stringify({ title: job.title, company: company.name, description: job.description, requirements: job.requirements })}`,
    mock: () => {
      const req = (job.requirements || []).map((s: string) => s.toLowerCase());
      const mine = cv.skills.flatMap((g) => g.items).filter((s) => req.includes(s.toLowerCase())).slice(0, 3);
      const proj = cv.projects[0];
      return {
        letter: `Dear ${company.name} hiring team,

I'm excited to apply for the ${job.title} position. ${cv.summary.split('. ')[0]}.${mine.length ? ` My experience with ${mine.join(', ')} lines up closely with what you're looking for.` : ''}

${proj ? `Recently I built ${proj.name}: ${proj.description} ` : ''}${cv.experience[0] ? `As ${cv.experience[0].title} at ${cv.experience[0].company}, I learned to deliver work that people actually use. ` : ''}I'd bring the same energy to ${company.name}${company.industry ? ` and its work in ${company.industry.toLowerCase()}` : ''}.

Thank you for considering my application. I'd love to talk about how I can help your team.

Best regards,
${cv.name}`,
      };
    },
  });
}

// ---------------------------------------------------------------- Job description writer (employers)

export type JobDraft = { title: string; level: string; description: string; responsibilities: string[]; requirements: string[]; nice_to_have: string[] };

export function draftJob(userId: number, brief: string, company: any, fresh = false) {
  return run<JobDraft>({
    kind: 'job-draft', userId, input: { brief, company: company.name }, fresh, maxTokens: 1200,
    prompt: () => `You are a recruiter writing an inclusive, clear job post for ${company.name} (${company.industry}).
Brief from the hiring manager: """${brief}"""
Return JSON: {"title": string, "level": "intern"|"junior"|"mid"|"senior", "description": string (2-3 sentences about the role and impact), "responsibilities": string[4-6], "requirements": string[4-7] (short skill names only, e.g. "React"), "nice_to_have": string[2-4] (short skill names)}`,
    mock: () => mockDraft(brief, company),
  });
}

const BRIEF_SKILLS = ['React', 'Next.js', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'SQL', 'PostgreSQL', 'Figma', 'Docker', 'AWS', 'Flutter', 'Excel', 'PowerBI', 'Machine Learning', 'Marketing', 'SEO', 'Java', 'Django', 'Communication', 'Git', 'Linux', 'Kotlin', 'Swift', 'Pandas', 'Tailwind', 'UX Design', 'Networking', 'Cybersecurity', 'Accounting', 'Sales', 'REST', 'Kubernetes'];

function mockDraft(brief: string, company: any): JobDraft {
  const lower = brief.toLowerCase();
  const esc = (s: string) => s.toLowerCase().replace('.js', '').replace(/[.+#]/g, '\\$&');
  const found = BRIEF_SKILLS.filter((s) => new RegExp(`(^|[^a-z])${esc(s)}(\\.js)?([^a-z]|$)`).test(lower));
  const level = /intern/.test(lower) ? 'intern' : /senior|lead/.test(lower) ? 'senior' : /mid|3\+|4\+/.test(lower) ? 'mid' : 'junior';
  const roleMatch = brief.match(/([a-z.+#/-]+\s+){0,2}(developer|engineer|designer|analyst|manager|specialist|intern|accountant|writer|scientist|coordinator|marketer)/i);
  const roleText = (roleMatch?.[0] || 'Team Member').replace(/^(a|an|need|hire|hiring|junior|senior|mid|lead)\s+/i, '').replace(/^(a|an|junior|senior|mid|lead)\s+/i, '');
  const title = roleText.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bReact\b/, 'React').replace(/\bUi\/ux\b/i, 'UI/UX');
  const reqs = found.length ? found : ['Communication', 'Problem Solving', 'Git'];
  return {
    title, level,
    description: `${company.name} is hiring a ${title} to help us grow. You'll work with a friendly, fast-moving team and see the impact of your work from week one.`,
    responsibilities: [
      `Own day-to-day ${title.toLowerCase()} work from idea to delivery`,
      'Collaborate with product, design and business colleagues',
      'Write clear documentation and share what you learn',
      'Suggest improvements to our tools and processes',
    ],
    requirements: reqs.slice(0, 6),
    nice_to_have: ['Team Work', 'English'],
  };
}

// ---------------------------------------------------------------- Fit insight (both sides)

export type Insight = { summary: string; strengths: string[]; concerns: string[]; questions: string[]; tips: string[] };

export function fitInsight(userId: number, audience: 'candidate' | 'employer', cv: CV, job: any, match: MatchResult, fresh = false) {
  return run<Insight>({
    kind: `insight-${audience}`, userId, input: { cv, jobId: job.id, title: job.title, req: job.requirements, audience }, fresh, maxTokens: 1000,
    prompt: () => `You are an AI recruiting assistant. Compare this CV with this job for the ${audience === 'employer' ? 'hiring manager' : 'candidate'}.
Our scoring engine already computed: ${JSON.stringify({ score: match.score, matched: match.matched, missing: match.missing })}
Return JSON: {"summary": string (2 sentences), "strengths": string[3], "concerns": string[1-3], "questions": string[4] (${audience === 'employer' ? 'specific interview questions to verify the fit' : 'questions the candidate should prepare to answer'}), "tips": string[3] (${audience === 'employer' ? 'what to probe or offer' : 'concrete ways to close skill gaps, e.g. a mini project or course topic'})}
CV: ${JSON.stringify(cv)}
Job: ${JSON.stringify({ title: job.title, level: job.level, description: job.description, requirements: job.requirements, nice_to_have: job.nice_to_have })}`,
    mock: () => {
      const who = audience === 'employer' ? cv.name.split(' ')[0] : 'You';
      const has = audience === 'employer' ? 'has' : 'have';
      return {
        summary: `${who} ${has} ${/^[aeiou]/i.test(match.label) ? "an" : "a"} ${match.label.toLowerCase()} (${match.score}/100) for ${job.title}. ${match.matched.length ? `Strongest overlap: ${match.matched.slice(0, 3).join(', ')}.` : 'Overlap with the core requirements is limited.'}`,
        strengths: [
          ...match.matched.slice(0, 2).map((s) => `Hands-on ${s}`),
          cv.projects[0] ? `Built ${cv.projects[0].name}` : cv.strengths[0] || 'Motivated learner',
        ].slice(0, 3),
        concerns: match.missing.length ? match.missing.slice(0, 3).map((s) => `No clear evidence of ${s}`) : ['No major gaps against the listed requirements'],
        questions: [
          match.matched[0] ? `Walk me through something you built with ${match.matched[0]}. What would you do differently now?` : 'Tell me about a project you are proud of.',
          cv.projects[0] ? `What was the hardest problem in ${cv.projects[0].name}, and how did you solve it?` : 'Describe a time you learned a new tool quickly.',
          match.missing[0] ? `How would you get productive with ${match.missing[0]} in your first month?` : 'Where do you want to grow in the next year?',
          `Why ${job.title}, and why now?`,
        ],
        tips: audience === 'employer'
          ? [
              match.missing[0] ? `Give a short take-home task around ${match.missing[0]}` : 'Move quickly; this profile covers the requirements',
              'Ask for a portfolio or GitHub walkthrough',
              'Pair them with a mentor for the first 90 days',
            ]
          : match.missing.length
            ? match.missing.slice(0, 3).map((s) => `Build a weekend mini-project using ${s} and add it to your CV`)
            : ['Tailor your summary to this role', 'Prepare one story per required skill', 'Apply soon: strong matches get noticed early'],
      };
    },
  });
}

# MatchPoint AI

An AI career portal. Job seekers describe their skills and passion, and an **AI agent writes their CV**, recommends the jobs that fit, and drafts cover letters. Employers describe a role in one sentence, and the agent **writes the job post**, ranks applicants by fit, recommends strong candidates who haven't applied yet, and suggests interview questions.

University project. All companies and people in the demo data are fictional.

## Features

**Job seekers**
- Profile builder: skills, passion, experience, projects, education and languages, with a live profile-strength score
- AI CV writer with three templates (modern, classic, compact), text editing, and PDF download (print)
- Match score (0–100) on every job, with matched, partial and missing skills and the reasons behind the score
- AI-recommended jobs, plus a "skills employers want from you" gap analysis across the job market
- AI cover letter per job, and an AI career coach (fit summary, how to close gaps, questions to prepare)
- Applications with a live pipeline (applied → shortlisted → interview → offer → hired), saved jobs, employer invites
- Notifications when an employer views your CV, invites you, or moves your application

**Employers**
- Hiring dashboard: 14-day application chart, hiring funnel, average match, latest applicants
- AI job-post writer: one sentence becomes a full post with required skills
- Applicants ranked by match score, with filtering by stage and one-click status changes (the candidate is notified)
- **AI-recommended candidates**: open-to-work people who fit but haven't applied, with one-click invites
- Full CV view, AI hiring assistant (strengths, risks, tailored interview questions) and private notes

**Platform**
- Landing page with a live activity feed and live stats
- `bun run simulate` makes the demo feel alive during a presentation (new applications and status changes every few seconds)

## How the AI works

| Task | How |
| --- | --- |
| Matching and ranking (both sides) | **Local scoring engine** in [`api/src/lib/match.ts`](api/src/lib/match.ts): 60% skill overlap (with aliases like JS → JavaScript), 25% text similarity (cosine over profile and job text), 15% seniority fit. It's free, instant and explainable, and runs on every page view. |
| CV, cover letter, job post, fit insights | **AI agent** in [`api/src/lib/ai.ts`](api/src/lib/ai.ts), with two modes: |
| | `AI_MODE=mock` (default): built-in offline agent. Free, no network. |
| | `AI_MODE=gemini`: Google Gemini (`gemini-2.5-flash`, thinking disabled, JSON output). |

Cost controls: every AI result is cached in Postgres (repeat clicks are free), each user has a daily cap (`AI_DAILY_LIMIT`, default 30), and every call is logged in the `ai_usage` table. The prompts tell the model to use only facts from the profile, so it never invents employers, dates or degrees.

## Stack

Monorepo with Bun workspaces:

```
api/   Bun HTTP server (Bun.serve routes) + PostgreSQL via Bun's built-in SQL client. No other runtime deps.
web/   Next.js 16 (App Router, React 19, TypeScript). /api/* is proxied to the Bun API.
```

## Run it locally

Requirements: [Bun](https://bun.sh) ≥ 1.2 and PostgreSQL ≥ 14 running locally.

```bash
bun install
```

```bash
createdb matchpoint
```

```bash
cp api/.env.example api/.env
```

```bash
bun run seed
```

```bash
bun run dev
```

Open http://localhost:3000. The API runs on http://localhost:4000.

Demo accounts (password `demo1234`; there are also one-click buttons on the login page):

- Job seeker: `candidate@matchpoint.demo` (Aram Hassan, frontend developer)
- Employer: `hr@nova.demo` (NovaPay). Every company has `hr@<key>.demo`, e.g. `hr@tigris.demo`.

Optional live activity during a demo (in a second terminal):

```bash
bun run simulate
```

## Using real Gemini

1. Put your key in `api/.env`: `GEMINI_API_KEY=...` and set `AI_MODE=gemini`.
2. Run a single tiny test call (a few hundred tokens):
   ```bash
   bun run smoke:gemini
   ```
3. Restart `bun run dev`. AI results in the UI are tagged **Gemini** instead of **Demo AI**.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | API (watch mode) and Next.js dev server together |
| `bun run seed` | Recreates the schema and loads demo data (wipes existing data) |
| `bun run db:setup` | Applies the schema without touching data |
| `bun run simulate` | Generates live activity every ~8s |
| `bun run test` | Unit tests for the matching engine |
| `bun run build` | Production build of the web app |
| `bun run smoke:gemini` | One real Gemini call to check the key |

## Project layout

```
api/src/
  index.ts            route table
  routes/             auth, public (stats, feed), jobs, candidate, employer
  lib/match.ts        scoring engine
  lib/ai.ts           AI agent (mock + Gemini), cache, daily cap
  db/schema.sql       PostgreSQL schema
  db/seed.ts          demo data generator
web/
  app/                pages (landing, jobs, candidate/*, employer/*)
  components/         UI kit, CV renderer, job form, nav and notifications
```

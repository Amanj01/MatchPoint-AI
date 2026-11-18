'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { useApp } from '@/components/Providers';
import { CompanyLogo, JobCard, timeAgo } from '@/components/ui';

type Stats = { open_jobs: number; companies: number; candidates: number; cvs: number; applications: number; offers: number; applications_today: number };
type Item = { kind: 'applied' | 'hired' | 'posted' | 'cv'; who: string; title: string; company: string; at: string };
type Company = { id: number; name: string; industry: string; location: string; color: string; open_jobs: number };

const ICON = { applied: '↗', hired: '★', posted: '+', cv: '✦' };

function feedText(i: Item) {
  if (i.kind === 'applied') return <><b>{i.who}</b> applied to <b>{i.title}</b> at {i.company}</>;
  if (i.kind === 'hired') return <><b>{i.who}</b> got an offer for <b>{i.title}</b> at {i.company}</>;
  if (i.kind === 'posted') return <><b>{i.company}</b> posted <b>{i.title}</b></>;
  return <><b>{i.who}</b> created a CV with the AI agent</>;
}

export default function Home() {
  const { user } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<Item[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const load = () => {
      api<Stats>('/stats').then(setStats).catch(() => {});
      api<{ items: Item[] }>('/activity').then((d) => setFeed(d.items)).catch(() => {});
    };
    load();
    api<{ jobs: Job[] }>('/jobs').then((d) => setJobs(d.jobs.slice(0, 6))).catch(() => {});
    api<{ companies: Company[] }>('/companies').then((d) => setCompanies(d.companies)).catch(() => {});
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const start = user ? `/${user.role}` : '/register';

  return (
    <>
      <section className="hero">
        <div>
          <span className="live-dot">{stats ? `${stats.applications_today} applications in the last 24h` : 'Live'}</span>
          <h1>Your skills, <em>matched</em> to the right job.</h1>
          <p className="lead">
            Tell our AI agent what you&apos;re good at and what you love. It writes a polished CV, finds the jobs that fit you,
            and puts you in front of employers who are looking for exactly you.
          </p>
          <div className="row" style={{ marginTop: 26 }}>
            <Link href={start} className="btn accent lg">{user ? 'Go to dashboard' : 'Build my CV with AI'}</Link>
            <Link href="/jobs" className="btn lg">Browse {stats?.open_jobs ?? ''} jobs</Link>
          </div>
          {stats && (
            <div className="hero-stats">
              <div className="stat"><b>{stats.candidates}</b><span>job seekers</span></div>
              <div className="stat"><b>{stats.companies}</b><span>companies hiring</span></div>
              <div className="stat"><b>{stats.cvs}</b><span>AI-written CVs</span></div>
              <div className="stat"><b>{stats.offers}</b><span>offers made</span></div>
            </div>
          )}
        </div>

        <div className="feed" aria-label="Live activity">
          {feed.map((i, k) => (
            <div key={`${i.kind}-${i.at}-${k}`} className="feed-item" style={{ animationDelay: `${k * 40}ms` }}>
              <span className={`feed-icon ${i.kind}`} aria-hidden>{ICON[i.kind]}</span>
              <span className="grow">{feedText(i)}</span>
              <span className="muted small">{timeAgo(i.at)}</span>
            </div>
          ))}
          {!feed.length && [0, 1, 2, 3, 4].map((k) => <div key={k} className="skeleton" style={{ height: 58 }} />)}
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <div><p className="eyebrow">How it works</p><h2>One AI agent, working for both sides</h2></div>
        </div>
        <div className="how">
          <div className="card">
            <h3>For job seekers</h3>
            <p className="muted">From blank page to interview, guided all the way.</p>
            <ol>
              <li><span><b>Tell us about you.</b> <span className="muted">Skills, passion, projects, experience. No formatting needed.</span></span></li>
              <li><span><b>The agent writes your CV.</b> <span className="muted">Polished, ATS-friendly, in three templates, ready to print as PDF.</span></span></li>
              <li><span><b>Get matched.</b> <span className="muted">Every job shows a match score, the skills you have, and the gaps to close.</span></span></li>
              <li><span><b>Apply in one click.</b> <span className="muted">The agent drafts a cover letter for each job, and you track every stage live.</span></span></li>
            </ol>
          </div>
          <div className="card dark" id="employers">
            <h3>For employers</h3>
            <p className="muted">Spend time on interviews, not on reading CVs.</p>
            <ol>
              <li><span><b>Describe the role in a sentence.</b> <span className="muted">The agent drafts a full job post with required skills.</span></span></li>
              <li><span><b>See applicants ranked by fit.</b> <span className="muted">Each one gets a transparent score with matched and missing skills.</span></span></li>
              <li><span><b>Discover recommended talent.</b> <span className="muted">Strong candidates who haven&apos;t applied yet, ready to invite.</span></span></li>
              <li><span><b>Interview smarter.</b> <span className="muted">AI fit summaries and tailored interview questions per candidate.</span></span></li>
            </ol>
            <p style={{ marginTop: 20, marginBottom: 0 }}><Link href={user?.role === 'employer' ? '/employer' : '/register?role=employer'} className="btn accent">Start hiring</Link></p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div><p className="eyebrow">Fresh openings</p><h2>Latest jobs</h2></div>
          <Link href="/jobs" className="btn">See all jobs →</Link>
        </div>
        <div className="cards">
          {jobs.map((j) => <JobCard key={j.id} job={j} />)}
          {!jobs.length && [0, 1, 2].map((k) => <div key={k} className="skeleton" style={{ height: 190 }} />)}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><p className="eyebrow">Hiring now</p><h2>Companies on MatchPoint</h2></div></div>
        <div className="companies">
          {companies.map((c) => (
            <div key={c.id} className="card company">
              <CompanyLogo name={c.name} color={c.color} size={40} />
              <div className="grow">
                <p><b>{c.name}</b></p>
                <p className="muted small">{c.industry} · {c.open_jobs} open</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

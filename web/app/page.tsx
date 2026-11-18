'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { useApp } from '@/components/Providers';
import { SearchBar, photo, salary } from '@/components/ui';

type Stats = { open_jobs: number; companies: number; candidates: number };

export default function Home() {
  const { user } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    api<Stats>('/stats').then(setStats).catch(() => {});
    api<{ jobs: Job[] }>('/jobs').then((d) => setJobs(d.jobs.slice(0, 4))).catch(() => {});
  }, []);

  const start = user ? `/${user.role}` : '/register';

  return (
    <>
      <section className="ehero">
        <img src={photo('1573497019940-1c28c88b4f3e', 1400)} alt="" className="bw" />
        <div className="ehero-top">
          <span className="label">CV &amp; job matching</span>
          <span className="label">Kurdistan · Iraq</span>
          <span className="label">{new Date().getFullYear()}</span>
        </div>

        <div className="ehero-main">
          <span className="cross" style={{ left: 0, top: 24 }} />
          <h1 className="mega"><b>Find work</b><span>that fits</span></h1>
          <p>Tell us what you&apos;re good at. We write your CV and match you with the right jobs.</p>
          <SearchBar />
        </div>

        <div className="ehero-bottom">
          <span>Write your CV</span><span>Get matched</span><span>Apply</span><span>Get hired</span>
        </div>
      </section>

      <section className="esection" id="how">
        <div className="esection-head">
          <div>
            <span className="label">How it works</span>
            <h2>Two sides<span>one match</span></h2>
          </div>
          <p>One place where people show what they can do, and companies find them.</p>
        </div>
        <div className="duo">
          <div>
            <span className="label red">Job seekers</span>
            <h3>Get hired</h3>
            <ul className="plus-list">
              <li>Describe your skills and passion</li>
              <li>Get a polished CV in seconds</li>
              <li>See your match on every job</li>
            </ul>
            <p style={{ marginTop: 24 }}><Link href={user?.role === 'candidate' ? '/candidate' : '/register'} className="btn primary">Create my CV</Link></p>
          </div>
          <div id="employers">
            <span className="label red">Employers</span>
            <h3>Hire faster</h3>
            <ul className="plus-list">
              <li>Post a job from one sentence</li>
              <li>See applicants ranked by fit</li>
              <li>Invite people who match</li>
            </ul>
            <p style={{ marginTop: 24 }}><Link href={user?.role === 'employer' ? '/employer' : '/register?role=employer'} className="btn">Start hiring</Link></p>
          </div>
        </div>
      </section>

      <section className="esection" style={{ paddingTop: 0 }}>
        <div className="esection-head">
          <div>
            <span className="label">Open roles</span>
            <h2>Hiring<span>now</span></h2>
          </div>
          <Link href="/jobs" className="arrow-link" style={{ justifySelf: 'end' }}>All {stats?.open_jobs ?? ''} jobs</Link>
        </div>
        <div>
          {jobs.map((j, i) => (
            <Link key={j.id} href={`/jobs?job=${j.id}`} className="jline">
              <span className="idx">0{i + 1}</span>
              <div><h3>{j.title}</h3><p>{j.company.name} · {j.remote ? 'Remote' : j.location}</p></div>
              <span className="muted small">{salary(j)}</span>
              <span className="row-arrow" aria-hidden>→</span>
            </Link>
          ))}
          {!jobs.length && [0, 1, 2, 3].map((k) => <div key={k} className="skeleton" style={{ height: 76, margin: '8px 0' }} />)}
        </div>
      </section>

      {stats && (
        <section className="esection" style={{ paddingTop: 0 }}>
          <div className="numbers">
            <div><b>{stats.open_jobs}<sup>+</sup></b><span className="label">Open roles</span></div>
            <div><b>{stats.companies}</b><span className="label">Companies</span></div>
            <div><b>{stats.candidates}<sup>+</sup></b><span className="label">Job seekers</span></div>
          </div>
        </section>
      )}

      <section className="eband">
        <div className="esection">
          <div>
            <span className="label">Start today</span>
            <h2 className="mega" style={{ marginTop: 14 }}><b>Your next</b><span>job</span></h2>
          </div>
          <Link href={start} className="btn lime lg">{user ? 'Open dashboard' : 'Get started'} →</Link>
        </div>
      </section>
    </>
  );
}

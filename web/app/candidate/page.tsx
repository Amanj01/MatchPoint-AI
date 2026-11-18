'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { RequireRole, useApp } from '@/components/Providers';
import { Bar, CompanyLogo, Empty, JobCard, ScoreRing, timeAgo } from '@/components/ui';

type Dash = {
  strength: { percent: number; todo: string[] }; hasCv: boolean; cvHeadline: string;
  recommended: Job[]; skillGaps: { skill: string; jobs: number }[];
  invites: { job_id: number; message: string; created_at: string; title: string; company: string; color: string }[];
  applications: Record<string, number> & { total: number }; cvViews7d: number;
};

function Dashboard() {
  const { user } = useApp();
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => { api<Dash>('/me/dashboard').then(setD).catch(() => {}); }, []);
  if (!d) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;
  const active = (d.applications.shortlisted || 0) + (d.applications.interview || 0) + (d.applications.offer || 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Hi {user!.name.split(' ')[0]} 👋</h1>
          <p className="muted">{d.hasCv ? d.cvHeadline : 'Let’s build your CV. The AI agent does the writing.'}</p>
        </div>
        <div className="row">
          <Link href="/candidate/profile" className="btn">Edit profile</Link>
          <Link href={d.hasCv ? '/candidate/cv' : '/candidate/profile'} className="btn ai">✦ {d.hasCv ? 'View my CV' : 'Create my CV'}</Link>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card stat"><b>{d.applications.total}</b><span>applications sent</span></div>
        <div className="card stat"><b>{active}</b><span>in progress (shortlist → offer)</span></div>
        <div className="card stat"><b>{d.recommended.filter((j) => (j.match?.score || 0) >= 55).length}</b><span>strong matches waiting</span></div>
        <div className="card stat"><b>{d.cvViews7d}</b><span>CV views by employers (7d)</span></div>
      </div>

      {d.invites.length > 0 && (
        <div className="card invite" style={{ marginBottom: 20 }}>
          <p className="eyebrow">Employers want you</p>
          <div className="stack">
            {d.invites.map((i) => (
              <Link key={i.job_id} href={`/jobs/${i.job_id}`} className="row">
                <CompanyLogo name={i.company} color={i.color} size={38} />
                <div className="grow"><b>{i.company}</b> invited you to apply for <b>{i.title}</b><div className="muted small">{i.message}</div></div>
                <span className="btn accent sm">View job</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="stack">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div><p className="eyebrow">Picked by the agent</p><h2>Recommended for you</h2></div>
            <Link href="/jobs" className="btn sm">All jobs</Link>
          </div>
          {d.recommended.length ? (
            <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>{d.recommended.map((j) => <JobCard key={j.id} job={j} />)}</div>
          ) : <Empty title="No recommendations yet"><p>Add skills to your profile so the agent can match you.</p></Empty>}
        </div>

        <div className="stack">
          <div className="card">
            <h3>Profile strength</h3>
            <div className="strength">
              <ScoreRing score={d.strength.percent} size={64} />
              <div className="grow">
                {d.strength.todo.length ? (
                  <ul className="tidy small">{d.strength.todo.slice(0, 4).map((t) => <li key={t}>{t}</li>)}</ul>
                ) : <p className="small" style={{ margin: 0 }}>Your profile is complete. Employers see you at your best.</p>}
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Skills employers want from you</h3>
            <p className="muted small">Skills missing from jobs you almost match. Learning one of these unlocks more matches.</p>
            {d.skillGaps.length ? (
              <div className="funnel">
                {d.skillGaps.map((g) => (
                  <div key={g.skill}><span>{g.skill}</span><Bar value={(g.jobs / d.skillGaps[0].jobs) * 100} tone="accent" /><b>{g.jobs}</b></div>
                ))}
              </div>
            ) : <p className="small">No gaps found. Nice!</p>}
          </div>

          <div className="card">
            <div className="card-title"><h3>Applications</h3><Link href="/candidate/applications" className="btn-link small">See all</Link></div>
            <div className="funnel">
              {['applied', 'shortlisted', 'interview', 'offer', 'rejected'].map((s) => (
                <div key={s}><span style={{ textTransform: 'capitalize' }}>{s === 'rejected' ? 'Not selected' : s}</span><Bar value={((d.applications[s] || 0) / Math.max(1, d.applications.total)) * 100} tone={s === 'rejected' ? 'low' : s === 'applied' ? undefined : 'great'} /><b>{d.applications[s] || 0}</b></div>
              ))}
            </div>
            <p className="muted small" style={{ margin: '12px 0 0' }}>Updated {timeAgo(new Date().toISOString())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireRole role="candidate"><Dashboard /></RequireRole>;
}

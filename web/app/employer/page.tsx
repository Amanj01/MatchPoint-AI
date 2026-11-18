'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { RequireRole, useApp } from '@/components/Providers';
import { Avatar, Bar, Empty, ScoreRing, StatusPill, timeAgo } from '@/components/ui';

type Dash = {
  company: { name: string; industry: string; location: string };
  jobs: (Job & { pipeline: Record<string, number> })[];
  pipeline: Record<string, number>;
  recent: { id: number; match_score: number; status: string; created_at: string; user_id: number; name: string; avatar_color: string; job_id: number; title: string }[];
  avgMatch: number; daily: { day: string; n: number }[];
};

const FUNNEL = ['applied', 'shortlisted', 'interview', 'offer', 'hired'];

function EmployerDash() {
  const { user } = useApp();
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => {
    const load = () => api<Dash>('/employer/dashboard').then(setD).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);
  if (!d) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;

  const total = Object.values(d.pipeline).reduce((a, b) => a + b, 0);
  const open = d.jobs.filter((j) => j.status === 'open');
  const max = Math.max(1, ...d.daily.map((x) => x.n));
  // "reached at least this stage" funnel
  const reached = (s: string) => FUNNEL.slice(FUNNEL.indexOf(s)).reduce((a, k) => a + (d.pipeline[k] || 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{d.company.name}</h1><p className="muted">Hiring dashboard · {user!.name}</p></div>
        <Link href="/employer/jobs/new" className="btn ai">✦ Post a job with AI</Link>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card stat"><b>{open.length}</b><span>open jobs</span></div>
        <div className="card stat"><b>{total}</b><span>total applicants</span></div>
        <div className="card stat"><b>{d.avgMatch}%</b><span>average match score</span></div>
        <div className="card stat"><b>{(d.pipeline.interview || 0) + (d.pipeline.offer || 0)}</b><span>in interview / offer</span></div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title"><h3>Applications, last 14 days</h3><span className="muted small">{d.daily.reduce((a, x) => a + x.n, 0)} total</span></div>
          <div className="chart" role="img" aria-label="Applications per day">
            {d.daily.map((x) => (
              <div key={x.day} title={`${x.day}: ${x.n}`}>
                <i style={{ height: Math.max(3, (x.n / max) * 92) }} />
                <small>{new Date(x.day).getDate()}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Hiring funnel</h3>
          <div className="funnel">
            {FUNNEL.map((s) => (
              <div key={s}><span style={{ textTransform: 'capitalize' }}>{s}</span><Bar value={(reached(s) / Math.max(1, total)) * 100} tone={s === 'applied' ? undefined : 'great'} /><b>{reached(s)}</b></div>
            ))}
            <div><span>Not selected</span><Bar value={((d.pipeline.rejected || 0) / Math.max(1, total)) * 100} tone="low" /><b>{d.pipeline.rejected || 0}</b></div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><h3>Your jobs</h3></div>
          {d.jobs.length === 0 ? (
            <Empty title="No jobs yet"><p>Describe a role in one sentence and the agent writes the post.</p><Link className="btn ai" href="/employer/jobs/new">✦ Post your first job</Link></Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Role</th><th>Applicants</th><th>Pipeline</th><th>Status</th></tr></thead>
                <tbody>
                  {d.jobs.map((j) => (
                    <tr key={j.id}>
                      <td><Link href={`/employer/jobs/${j.id}`}><b>{j.title}</b></Link><div className="muted small">{j.level} · posted {timeAgo(j.created_at)} · {j.views} views</div></td>
                      <td><b>{j.applicants}</b>{(j.applicants_today || 0) > 0 && <span className="tag tag-accent" style={{ marginLeft: 6 }}>+{j.applicants_today} today</span>}</td>
                      <td className="small muted">{['shortlisted', 'interview', 'offer'].map((s) => `${j.pipeline[s] || 0} ${s.slice(0, 5)}`).join(' · ')}</td>
                      <td><span className={`pill ${j.status === 'open' ? 'status-offer' : 'status-rejected'}`}>{j.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="card-title" style={{ padding: '18px 18px 0' }}><h3>Latest applicants</h3></div>
          {d.recent.length === 0 && <p className="muted pad">No applicants yet.</p>}
          {d.recent.map((r) => (
            <Link key={r.id} href={`/employer/jobs/${r.job_id}?candidate=${r.user_id}`} className="person">
              <Avatar name={r.name} color={r.avatar_color} />
              <div className="grow"><h3>{r.name}</h3><p className="muted small">{r.title} · {timeAgo(r.created_at)}</p></div>
              <StatusPill status={r.status} />
              <ScoreRing score={r.match_score} size={40} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireRole role="employer"><EmployerDash /></RequireRole>;
}

'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { RequireRole } from '@/components/Providers';
import { Avatar, Empty, MatchBadge } from '@/components/ui';

type Dash = {
  company: { name: string; industry: string; location: string; cover_url: string | null };
  jobs: (Job & { pipeline: Record<string, number> })[];
  pipeline: Record<string, number>;
  recent: { id: number; match_score: number; user_id: number; name: string; avatar_color: string; avatar_url: string | null; job_id: number; title: string }[];
};

function EmployerDash() {
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => {
    const load = () => api<Dash>('/employer/dashboard').then(setD).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);
  if (!d) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;

  const total = Object.values(d.pipeline).reduce((a, b) => a + b, 0);
  const open = d.jobs.filter((j) => j.status === 'open').length;
  const interviewing = (d.pipeline.interview || 0) + (d.pipeline.offer || 0);

  return (
    <div className="page" style={{ maxWidth: 1040 }}>
      <div className="page-head">
        <div>
          <span className="label">{d.company.industry} · {d.company.location}</span>
          <h1 style={{ margin: '8px 0 0' }}>{d.company.name}</h1>
        </div>
        <Link href="/employer/jobs/new" className="btn primary">Post a job</Link>
      </div>

      <div className="numbers" style={{ marginBottom: 72 }}>
        <div><b>{open}</b><span className="label">Open jobs</span></div>
        <div><b>{total}</b><span className="label">Applicants</span></div>
        <div><b>{interviewing}</b><span className="label">Interviewing</span></div>
      </div>

      <div className="cols" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <div>
          <div className="section-label"><h2>Jobs</h2></div>
          {d.jobs.length === 0 ? (
            <Empty title="No jobs yet"><Link className="btn primary" href="/employer/jobs/new">Post your first job</Link></Empty>
          ) : d.jobs.map((j, i) => (
            <Link key={j.id} href={`/employer/jobs/${j.id}`} className="jline">
              <span className="idx">0{i + 1}</span>
              <div><h3 style={{ fontSize: '1.05rem' }}>{j.title}</h3><p>{j.status === 'closed' ? 'Closed' : `${j.applicants} applicants`}{(j.applicants_today || 0) > 0 ? ` · ${j.applicants_today} new today` : ''}</p></div>
              <span />
              <span className="row-arrow" aria-hidden>→</span>
            </Link>
          ))}
        </div>

        <aside>
          <div className="section-label"><h3>New applicants</h3></div>
          {d.recent.slice(0, 4).map((r) => (
            <Link key={r.id} href={`/employer/jobs/${r.job_id}?candidate=${r.user_id}`} className="row nowrap" style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
              <Avatar name={r.name} color={r.avatar_color} src={r.avatar_url} size={36} />
              <span className="grow small"><b style={{ fontWeight: 600 }}>{r.name}</b><br /><span className="muted">{r.title}</span></span>
              <MatchBadge score={r.match_score} />
            </Link>
          ))}
          {!d.recent.length && <p className="muted small" style={{ marginTop: 14 }}>No applicants yet.</p>}
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireRole role="employer"><EmployerDash /></RequireRole>;
}

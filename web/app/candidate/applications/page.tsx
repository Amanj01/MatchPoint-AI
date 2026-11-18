'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RequireRole } from '@/components/Providers';
import { CompanyLogo, Empty, Pipeline, ScoreRing, StatusPill, timeAgo } from '@/components/ui';

type App = { id: number; status: string; match_score: number; created_at: string; updated_at: string; source: string; job_id: number; title: string; location: string; remote: boolean; company: string; color: string };

function Applications() {
  const [apps, setApps] = useState<App[] | null>(null);
  const [filter, setFilter] = useState('all');
  useEffect(() => { api<{ applications: App[] }>('/me/applications').then((d) => setApps(d.applications)); }, []);
  if (!apps) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;
  const active = apps.filter((a) => !['rejected', 'hired'].includes(a.status));
  const shown = filter === 'all' ? apps : filter === 'active' ? active : apps.filter((a) => a.status === 'rejected' || a.status === 'hired');

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>My applications</h1><p className="muted">Live status from each employer. You get a notification whenever something changes.</p></div>
        <div className="segmented">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All ({apps.length})</button>
          <button className={filter === 'active' ? 'on' : ''} onClick={() => setFilter('active')}>Active ({active.length})</button>
          <button className={filter === 'closed' ? 'on' : ''} onClick={() => setFilter('closed')}>Closed</button>
        </div>
      </div>
      {shown.length === 0 ? (
        <Empty title="No applications here"><p>Find a job that matches you and apply in one click.</p><Link href="/jobs" className="btn accent">Browse jobs</Link></Empty>
      ) : (
        <div className="stack">
          {shown.map((a) => (
            <Link key={a.id} href={`/jobs/${a.job_id}`} className="card job-card">
              <div className="job-card-top">
                <CompanyLogo name={a.company} color={a.color} />
                <div className="grow">
                  <h3>{a.title}</h3>
                  <p className="muted small">{a.company} · {a.remote ? 'Remote' : a.location} · applied {timeAgo(a.created_at)}{a.source === 'invited' ? ' · invited by employer' : ''}</p>
                </div>
                <StatusPill status={a.status} />
                <ScoreRing score={a.match_score} size={46} />
              </div>
              <Pipeline status={a.status} />
              <p className="muted small" style={{ margin: 0 }}>Last update {timeAgo(a.updated_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <RequireRole role="candidate"><Applications /></RequireRole>;
}

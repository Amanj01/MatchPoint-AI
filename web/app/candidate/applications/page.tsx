'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RequireRole } from '@/components/Providers';
import { CompanyLogo, Empty, MatchBadge, Pipeline, StatusPill, timeAgo } from '@/components/ui';

type App = { id: number; status: string; match_score: number; created_at: string; updated_at: string; source: string; job_id: number; title: string; location: string; remote: boolean; company: string; color: string };

function Applications() {
  const [apps, setApps] = useState<App[] | null>(null);
  const [filter, setFilter] = useState('all');
  useEffect(() => { api<{ applications: App[] }>('/me/applications').then((d) => setApps(d.applications)); }, []);
  if (!apps) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;
  const active = apps.filter((a) => !['rejected', 'hired'].includes(a.status));
  const closed = apps.filter((a) => ['rejected', 'hired'].includes(a.status));
  const shown = filter === 'all' ? apps : filter === 'active' ? active : closed;

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-head">
        <div><h1>Applications</h1><p className="muted">Live status from each employer. You&apos;re notified whenever something changes.</p></div>
        <div className="pills">
          <button className={`pill-btn ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All<span className="n">{apps.length}</span></button>
          <button className={`pill-btn ${filter === 'active' ? 'on' : ''}`} onClick={() => setFilter('active')}>Active<span className="n">{active.length}</span></button>
          <button className={`pill-btn ${filter === 'closed' ? 'on' : ''}`} onClick={() => setFilter('closed')}>Closed<span className="n">{closed.length}</span></button>
        </div>
      </div>
      {shown.length === 0 ? (
        <Empty title="Nothing here yet"><p>Find a job that matches you and apply in one click.</p><Link href="/jobs" className="btn primary">Browse jobs</Link></Empty>
      ) : (
        <div className="list">
          {shown.map((a) => (
            <Link key={a.id} href={`/jobs/${a.job_id}`} className="list-row" style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) minmax(0,1.1fr) auto', gap: 18 }}>
              <CompanyLogo name={a.company} color={a.color} size={44} />
              <div>
                <h3>{a.title}</h3>
                <p className="meta"><span>{a.company}</span><span>{a.remote ? 'Remote' : a.location}</span><span>applied {timeAgo(a.created_at)}</span></p>
              </div>
              <Pipeline status={a.status} />
              <div className="side" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <StatusPill status={a.status} />
                <MatchBadge score={a.match_score} />
              </div>
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

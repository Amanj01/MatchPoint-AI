'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { RequireRole, useApp } from '@/components/Providers';
import { Avatar, Empty, JobRow, StatusPill } from '@/components/ui';

type Dash = {
  strength: { percent: number; todo: string[] }; hasCv: boolean; cvHeadline: string;
  recommended: Job[];
  invites: { job_id: number; title: string; company: string }[];
};
type App = { id: number; status: string; job_id: number; title: string; company: string };

function Dashboard() {
  const { user } = useApp();
  const [d, setD] = useState<Dash | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  useEffect(() => {
    api<Dash>('/me/dashboard').then(setD).catch(() => {});
    api<{ applications: App[] }>('/me/applications').then((x) => setApps(x.applications)).catch(() => {});
  }, []);
  if (!d) return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;

  return (
    <div className="page" style={{ maxWidth: 1040 }}>
      <div className="page-head">
        <div className="hello">
          <Avatar name={user!.name} color={user!.avatar_color} src={user!.avatar_url} size={64} />
          <div>
            <span className="label">Dashboard</span>
            <h1 style={{ margin: '6px 0 0' }}>Hi, {user!.name.split(' ')[0]}</h1>
          </div>
        </div>
        <Link href={d.hasCv ? '/candidate/cv' : '/candidate/profile'} className="btn primary">{d.hasCv ? 'My CV' : 'Create my CV'}</Link>
      </div>

      {d.invites[0] && (
        <Link href={`/jobs/${d.invites[0].job_id}`} className="invite">
          <span className="label red">Invited</span>
          <p className="grow"><b>{d.invites[0].company}</b> wants you to apply for <b>{d.invites[0].title}</b></p>
          <span className="arrow-link">View</span>
        </Link>
      )}
      {!d.invites[0] && d.strength.todo[0] && (
        <Link href="/candidate/profile" className="invite">
          <span className="label">Next step</span>
          <p className="grow">{d.strength.todo[0]}</p>
          <span className="arrow-link">Go</span>
        </Link>
      )}

      <div className="cols" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <div>
          <div className="section-label"><h2>Best matches</h2><Link href="/jobs" className="arrow-link small">All jobs</Link></div>
          {d.recommended.length ? (
            <div className="list">{d.recommended.slice(0, 5).map((j) => <JobRow key={j.id} job={j} />)}</div>
          ) : <Empty title="No matches yet"><p>Add skills to your profile.</p></Empty>}
        </div>

        <aside>
          <div className="section-label"><h3>Applications</h3><Link href="/candidate/applications" className="arrow-link small">All</Link></div>
          {apps.slice(0, 4).map((a) => (
            <Link key={a.id} href={`/jobs/${a.job_id}`} className="row nowrap" style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="grow small"><b style={{ fontWeight: 600 }}>{a.title}</b><br /><span className="muted">{a.company}</span></span>
              <StatusPill status={a.status} />
            </Link>
          ))}
          {!apps.length && <p className="muted small" style={{ marginTop: 14 }}>None yet.</p>}
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireRole role="candidate"><Dashboard /></RequireRole>;
}

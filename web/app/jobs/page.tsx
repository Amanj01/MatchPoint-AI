'use client';
import { useEffect, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { useApp } from '@/components/Providers';
import { Empty, JobCard } from '@/components/ui';

export default function Jobs() {
  const { user, loading } = useApp();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const [remote, setRemote] = useState(false);
  const isCandidate = user?.role === 'candidate';
  const [sort, setSort] = useState<'match' | 'new'>('match');

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams({ q, level, ...(remote ? { remote: '1' } : {}), ...(isCandidate && sort === 'match' ? { sort: 'match' } : {}) });
      api<{ jobs: Job[] }>(`/jobs?${p}`).then((d) => setJobs(d.jobs)).catch(() => setJobs([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, level, remote, sort, isCandidate, loading]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Find your next role</h1>
          <p className="muted">{isCandidate ? 'Sorted by how well each job matches your CV.' : 'Log in as a job seeker to see your match score on every job.'}</p>
        </div>
        {isCandidate && (
          <div className="segmented">
            <button className={sort === 'match' ? 'on' : ''} onClick={() => setSort('match')}>Best match</button>
            <button className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>Newest</button>
          </div>
        )}
      </div>

      <div className="card flat row" style={{ marginBottom: 20, padding: 12 }}>
        <input className="input grow" style={{ minWidth: 200 }} placeholder="Search title, company, skill or city…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" />
        <select className="input" style={{ width: 'auto' }} value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
          <option value="">All levels</option><option value="intern">Intern</option><option value="junior">Junior</option><option value="mid">Mid</option><option value="senior">Senior</option>
        </select>
        <label className="check"><input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} /> Remote only</label>
      </div>

      {jobs === null ? (
        <div className="cards">{[0, 1, 2, 3, 4, 5].map((k) => <div key={k} className="skeleton" style={{ height: 190 }} />)}</div>
      ) : jobs.length ? (
        <>
          <p className="muted small">{jobs.length} open job{jobs.length === 1 ? '' : 's'}</p>
          <div className="cards">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>
        </>
      ) : (
        <Empty title="No jobs match that search"><p>Try a different keyword or clear the filters.</p></Empty>
      )}
    </div>
  );
}

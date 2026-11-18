'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { useApp } from '@/components/Providers';
import { JobDetail } from '@/components/JobDetail';
import { Empty, JobRow, SearchBar } from '@/components/ui';

const LEVELS = ['intern', 'junior', 'mid', 'senior'];

export default function Jobs() {
  const { user, loading } = useApp();
  const router = useRouter();
  const [all, setAll] = useState<Job[] | null>(null);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [level, setLevel] = useState('');
  const [remote, setRemote] = useState(false);
  const [sort, setSort] = useState<'match' | 'new'>('match');
  const [selected, setSelected] = useState<number | null>(null);
  const isCandidate = user?.role === 'candidate';

  // Read the initial filters from the URL once.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setQ(p.get('q') || ''); setCity(p.get('city') || '');
    if (p.get('job')) setSelected(Number(p.get('job')));
  }, []);

  const load = useCallback(() => {
    api<{ jobs: Job[] }>(`/jobs${isCandidate ? '?sort=match' : ''}`).then((d) => setAll(d.jobs)).catch(() => setAll([]));
  }, [isCandidate]);
  useEffect(() => { if (!loading) load(); }, [load, loading]);

  const jobs = useMemo(() => {
    if (!all) return null;
    const t = q.toLowerCase().trim();
    let out = all.filter((j) =>
      (!t || [j.title, j.company.name, j.location, ...j.requirements].join(' ').toLowerCase().includes(t)) &&
      (!city || (city === 'Remote' ? j.remote : j.location === city)) &&
      (!level || j.level === level) &&
      (!remote || j.remote));
    if (!isCandidate || sort === 'new') out = [...out].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return out;
  }, [all, q, city, level, remote, sort, isCandidate]);

  const levelCount = (l: string) => (all || []).filter((j) => j.level === l).length;

  // Keep a job selected, and the URL in sync so the view can be shared.
  useEffect(() => {
    if (!jobs?.length) return;
    if (!selected || !jobs.some((j) => j.id === selected)) setSelected(jobs[0].id);
  }, [jobs, selected]);
  useEffect(() => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(city ? { city } : {}), ...(selected ? { job: String(selected) } : {}) });
    history.replaceState(null, '', `/jobs${p.toString() ? `?${p}` : ''}`);
  }, [q, city, selected]);

  // ↑ / ↓ (or j / k) move through the list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!jobs?.length || (e.target as HTMLElement).closest('input, textarea, select')) return;
      const i = jobs.findIndex((j) => j.id === selected);
      const next = e.key === 'ArrowDown' || e.key === 'j' ? i + 1 : e.key === 'ArrowUp' || e.key === 'k' ? i - 1 : null;
      if (next === null) return;
      e.preventDefault();
      const j = jobs[Math.max(0, Math.min(jobs.length - 1, next))];
      setSelected(j.id);
      document.getElementById(`job-${j.id}`)?.scrollIntoView({ block: 'nearest' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [jobs, selected]);

  const pick = (id: number) => {
    if (window.innerWidth < 960) router.push(`/jobs/${id}`);
    else setSelected(id);
  };

  return (
    <div className="page" style={{ paddingTop: 32 }}>
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <h1>Jobs</h1>
          <p className="muted">{isCandidate ? 'Sorted by how well each one matches your CV.' : 'Log in as a job seeker to see your match on every job.'}</p>
        </div>
      </div>

      <SearchBar q={q} city={city} onSearch={(a, b) => { setQ(a); setCity(b); }} />

      <div className="board-toolbar">
        <div className="pills" role="group" aria-label="Level">
          <button className={`pill-btn ${!level ? 'on' : ''}`} onClick={() => setLevel('')}>All<span className="n">{all?.length ?? ''}</span></button>
          {LEVELS.map((l) => (
            <button key={l} className={`pill-btn ${level === l ? 'on' : ''}`} onClick={() => setLevel(level === l ? '' : l)} style={{ textTransform: 'capitalize' }}>{l}<span className="n">{levelCount(l)}</span></button>
          ))}
        </div>
        <div className="row">
          <label className="check small"><button type="button" className={`toggle ${remote ? 'on' : ''}`} onClick={() => setRemote(!remote)} aria-pressed={remote} aria-label="Remote only" /> Remote only</label>
          {isCandidate && (
            <div className="segmented">
              <button className={sort === 'match' ? 'on' : ''} onClick={() => setSort('match')}>Best match</button>
              <button className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>Newest</button>
            </div>
          )}
        </div>
      </div>

      <div className="board">
        <div className="board-list">
          <p className="muted small" style={{ margin: '8px 0' }}>
            {jobs ? `${jobs.length} job${jobs.length === 1 ? '' : 's'}` : 'Loading…'}
            <span style={{ float: 'right' }}><span className="kbd">↑</span> <span className="kbd">↓</span> to browse</span>
          </p>
          {jobs === null ? [0, 1, 2, 3, 4].map((k) => <div key={k} className="skeleton" style={{ height: 72, margin: '8px 0' }} />)
            : jobs.length === 0 ? <Empty title="No jobs match"><p>Try another keyword or clear the filters.</p></Empty>
            : <div className="list">{jobs.map((j) => <div key={j.id} id={`job-${j.id}`}><JobRow job={j} active={j.id === selected} onSelect={() => pick(j.id)} /></div>)}</div>}
        </div>
        <div className="board-detail" aria-live="polite">
          {selected ? <JobDetail key={selected} id={selected} variant="pane" onChanged={load} /> : <div className="job-body"><Empty title="Pick a job" /></div>}
        </div>
      </div>
    </div>
  );
}

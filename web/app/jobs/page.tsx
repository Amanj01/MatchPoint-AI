'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Job } from '@/lib/api';
import { useApp } from '@/components/Providers';
import { JobDetail } from '@/components/JobDetail';
import { Empty, JobRow, SearchBar } from '@/components/ui';

const LEVELS = ['intern', 'junior', 'mid', 'senior'];
const PER_PAGE = 5;

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

  // Read the initial filters from the URL once (a ?job= link opens the page that holds it).
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

  // ---- Pagination
  const [page, setPage] = useState(1);
  const pages = jobs ? Math.max(1, Math.ceil(jobs.length / PER_PAGE)) : 1;
  const pageJobs = jobs ? jobs.slice((page - 1) * PER_PAGE, page * PER_PAGE) : null;
  const placed = useRef(false);

  // New filters start again at page 1.
  useEffect(() => { if (placed.current) { setPage(1); setSelected(null); } }, [q, city, level, remote, sort]);
  // On first load, open the page that holds the job from the URL.
  useEffect(() => {
    if (placed.current || !jobs?.length) return;
    placed.current = true;
    const i = jobs.findIndex((j) => j.id === selected);
    if (i >= 0) setPage(Math.floor(i / PER_PAGE) + 1);
  }, [jobs, selected]);

  function goTo(p: number) {
    if (!jobs) return;
    const next = Math.max(1, Math.min(pages, p));
    setPage(next);
    setSelected(jobs[(next - 1) * PER_PAGE]?.id ?? null);
    listTop.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  const listTop = useRef<HTMLDivElement>(null);

  // Keep a job on the current page selected, and the URL in sync so the view can be shared.
  useEffect(() => {
    if (!pageJobs?.length) return;
    if (!selected || !jobs!.some((j) => j.id === selected)) setSelected(pageJobs[0].id);
  }, [pageJobs, jobs, selected]);
  useEffect(() => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(city ? { city } : {}), ...(page > 1 ? { page: String(page) } : {}), ...(selected ? { job: String(selected) } : {}) });
    history.replaceState(null, '', `/jobs${p.toString() ? `?${p}` : ''}`);
  }, [q, city, page, selected]);

  // ↑ / ↓ (or j / k) move through the list, flipping pages at the edges. ← / → change page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!jobs?.length || (e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); goTo(page + (e.key === 'ArrowRight' ? 1 : -1)); return; }
      const i = jobs.findIndex((j) => j.id === selected);
      const next = e.key === 'ArrowDown' || e.key === 'j' ? i + 1 : e.key === 'ArrowUp' || e.key === 'k' ? i - 1 : null;
      if (next === null) return;
      e.preventDefault();
      const n = Math.max(0, Math.min(jobs.length - 1, next));
      setSelected(jobs[n].id);
      setPage(Math.floor(n / PER_PAGE) + 1);
      setTimeout(() => document.getElementById(`job-${jobs[n].id}`)?.scrollIntoView({ block: 'nearest' }));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

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
          <button className={`pill-btn ${!level ? 'on' : ''}`} onClick={() => setLevel('')}>All</button>
          {LEVELS.map((l) => (
            <button key={l} className={`pill-btn ${level === l ? 'on' : ''}`} onClick={() => setLevel(level === l ? '' : l)} style={{ textTransform: 'capitalize' }}>{l}</button>
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

      <p className="small" style={{ margin: '8px 0 10px' }}><span className="label">{jobs ? (jobs.length > PER_PAGE ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, jobs.length)} of ${jobs.length} jobs` : `${jobs.length} jobs`) : 'Loading'}</span></p>

      <div className="board">
        <div className="board-list" ref={listTop} style={{ scrollMarginTop: 90 }}>
          {jobs === null ? [0, 1, 2, 3, 4].map((k) => <div key={k} className="skeleton" style={{ height: 72, margin: '8px 0' }} />)
            : jobs.length === 0 ? <Empty title="No jobs match"><p>Try another keyword or clear the filters.</p></Empty>
            : <div className="list">{pageJobs!.map((j) => <div key={j.id} id={`job-${j.id}`}><JobRow job={j} active={j.id === selected} onSelect={() => pick(j.id)} /></div>)}</div>}

          {pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button className="pager-step" onClick={() => goTo(page - 1)} disabled={page === 1} aria-label="Previous page">← Prev</button>
              <div className="pager-nums">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button key={n} className={n === page ? 'on' : ''} onClick={() => goTo(n)} aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`}>
                    {String(n).padStart(2, '0')}
                  </button>
                ))}
              </div>
              <button className="pager-step" onClick={() => goTo(page + 1)} disabled={page === pages} aria-label="Next page">Next →</button>
            </nav>
          )}
        </div>
        <div className="board-detail" aria-live="polite">
          <div className="board-detail-scroll">
            {selected ? <JobDetail key={selected} id={selected} variant="pane" onChanged={load} /> : <div className="job-body"><Empty title="Pick a job" /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

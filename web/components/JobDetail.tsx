'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type Insight, type Job, type Match } from '@/lib/api';
import { useApp } from './Providers';
import { AiTag, CompanyLogo, Pipeline, ScoreRing, StatusPill, Thinking, salary } from './ui';

type Detail = {
  job: Job; match?: Match; saved?: boolean; hasCv?: boolean;
  application?: { id: number; status: string; created_at: string; events: { status: string; created_at: string }[] } | null;
  invite?: { message: string; created_at: string } | null;
};

/** Everything about one job. `pane` = inside the job board's side panel, `page` = full page with AI tools. */
export function JobDetail({ id, variant, onChanged }: { id: number; variant: 'pane' | 'page'; onChanged?: () => void }) {
  const { user, loading, toast } = useApp();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [letter, setLetter] = useState('');
  const [letterMeta, setLetterMeta] = useState<any>();
  const [writing, setWriting] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [thinking, setThinking] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => api<Detail>(`/jobs/${id}`).then((x) => { setD(x); setErr(''); }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { setD(null); setLetter(''); setInsight(null); if (!loading) load(); }, [load, loading, user]);

  async function writeLetter() {
    setWriting(true);
    try {
      const r = await api<{ letter: string; _ai: any }>(`/jobs/${id}/cover-letter`, { body: { regenerate: !!letter } });
      setLetter(r.letter); setLetterMeta(r._ai);
    } catch (e: any) { toast(e.message, 'error'); }
    setWriting(false);
  }
  async function coach() {
    setThinking(true);
    try { setInsight(await api<Insight>(`/jobs/${id}/insight`, { body: {} })); } catch (e: any) { toast(e.message, 'error'); }
    setThinking(false);
  }
  async function apply() {
    setApplying(true);
    try {
      await api(`/jobs/${id}/apply`, { body: { cover_letter: letter } });
      toast('Application sent. The employer can see your CV now.');
      await load(); onChanged?.();
    } catch (e: any) { toast(e.message, 'error'); }
    setApplying(false);
  }
  async function toggleSave() {
    const r = await api<{ saved: boolean }>(`/jobs/${id}/save`, { method: 'POST' });
    setD((x) => x && { ...x, saved: r.saved });
    toast(r.saved ? 'Saved' : 'Removed from saved');
  }

  if (err) return <div className="job-body"><h2>Job not found</h2><p className="muted">{err}</p></div>;
  if (!d) return <div className="job-body"><div className="skeleton" style={{ height: 180, marginBottom: 16 }} /><div className="skeleton" style={{ height: 24, width: '60%' }} /></div>;

  const { job, match, application } = d;
  const isCandidate = user?.role === 'candidate';
  const isPage = variant === 'page';

  const actions = isCandidate && d.hasCv && !application && (
    <div className="row" style={{ margin: '4px 0 6px' }}>
      <button className="btn primary" onClick={apply} disabled={applying || job.status === 'closed'}>{applying ? 'Sending…' : letter ? 'Apply with letter' : 'Apply now'}</button>
      <button className="btn" onClick={toggleSave} aria-pressed={d.saved}>{d.saved ? 'Saved' : 'Save'}</button>
      {!isPage && <Link href={`/jobs/${job.id}`} className="arrow-link small" style={{ marginLeft: 6 }}>Cover letter</Link>}
    </div>
  );

  return (
    <div className={isPage ? 'job-page' : ''}>
      {isPage && (
        <div className="job-cover">
          {job.company.cover ? <img src={job.company.cover} alt="" /> : <div style={{ height: 120 }} />}
          <CompanyLogo name={job.company.name} color={job.company.color} size={72} />
        </div>
      )}

      <div className={isPage ? '' : 'job-body'}>
        <div className={isPage ? 'job-title' : ''}>
          <div className="row between nowrap" style={{ alignItems: 'flex-start' }}>
            <div>
              {!isPage && (
                <div className="row nowrap" style={{ gap: 10, marginBottom: 14 }}>
                  <CompanyLogo name={job.company.name} color={job.company.color} size={28} />
                  <span className="label">{job.company.name}</span>
                </div>
              )}
              <h1 style={{ fontSize: isPage ? undefined : '1.7rem', marginBottom: 4 }}>{job.title}</h1>
              {isPage && <p className="muted" style={{ margin: 0 }}>{job.company.name} · {job.company.industry}</p>}
            </div>
            {match && <ScoreRing score={match.score} size={isPage ? 72 : 60} />}
          </div>
          <div className="job-facts">
            <span>{job.remote ? 'Remote' : job.location}</span>
            <span style={{ textTransform: 'capitalize' }}>{job.level}</span>
            {salary(job) && <span>{salary(job)}</span>}
            {job.status === 'closed' && <span className="tag tag-accent">Closed</span>}
          </div>
        </div>

        {d.invite && !application && (
          <p className="small" style={{ margin: '0 0 16px' }}><span className="label red">Invited</span> {job.company.name} asked you to apply.</p>
        )}

        {!user && !loading && (
          <div className="row" style={{ marginBottom: 8 }}>
            <Link href="/register" className="btn primary">Sign up to see your match</Link>
            <Link href="/login" className="btn">Log in</Link>
          </div>
        )}
        {isCandidate && !d.hasCv && <Link href="/candidate/profile" className="btn primary">Create your CV to apply</Link>}
        {actions}

        {application && (
          <div className="job-section">
            <div className="row between"><h3 style={{ margin: 0 }}>Your application</h3><StatusPill status={application.status} /></div>
            <div style={{ marginTop: 14 }}><Pipeline status={application.status} /></div>
          </div>
        )}

        <div className="job-section">
          <div className="row between" style={{ marginBottom: 10 }}>
            <span className="label">Skills</span>
            {match && <span className="muted tiny">{match.matched.length} of {job.requirements.length} on your CV</span>}
          </div>
          <div className="chips">
            {job.requirements.map((s) => <span key={s} className={`chip ${match ? (match.matched.includes(s) ? 'ok' : match.partial.includes(s) ? 'part' : 'miss') : ''}`}>{s}</span>)}
          </div>
        </div>
        <div className="job-section">
          <span className="label">The role</span>
          <p style={{ marginTop: 10 }}>{job.description}</p>
          {isPage && job.responsibilities?.length > 0 && <ul className="plus-list">{job.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>}
        </div>
        {isPage && job.company.about && (
          <div className="job-section">
            <span className="label">About {job.company.name}</span>
            <p className="muted" style={{ margin: 0 }}>{job.company.about}</p>
          </div>
        )}

        {isPage && isCandidate && d.hasCv && (
          <div className="grid-2" style={{ marginTop: 12, gap: 20 }}>
            {!application && (
              <div className="panel">
                <div className="row between"><h3 style={{ margin: 0 }}>Cover letter</h3><AiTag meta={letterMeta} /></div>
                {writing ? <Thinking text="Writing your cover letter" /> : letter ? (
                  <textarea className="input letter" rows={12} value={letter} onChange={(e) => setLetter(e.target.value)} aria-label="Cover letter" style={{ marginTop: 12 }} />
                ) : <p className="muted small" style={{ marginTop: 8 }}>We write it from your CV for this job. Edit it, then apply.</p>}
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn ai" onClick={writeLetter} disabled={writing}>{letter ? 'Rewrite' : 'Write my cover letter'}</button>
                  {letter && <button className="btn primary" onClick={apply} disabled={applying}>Apply with this letter</button>}
                </div>
              </div>
            )}
            <div className="panel">
              <div className="row between"><h3 style={{ margin: 0 }}>Interview coach</h3><AiTag meta={insight?._ai} /></div>
              {thinking ? <Thinking text="Comparing your CV with this job" /> : insight ? (
                <div className="stack small" style={{ marginTop: 10 }}>
                  <p style={{ margin: 0 }}>{insight.summary}</p>
                  <div><b>Close the gap</b><ul className="tidy">{insight.tips.map((t) => <li key={t}>{t}</li>)}</ul></div>
                  <div><b>Questions to prepare</b><ul className="tidy">{insight.questions.map((t) => <li key={t}>{t}</li>)}</ul></div>
                </div>
              ) : (
                <>
                  <p className="muted small" style={{ marginTop: 8 }}>What makes you a fit, what&apos;s missing, and the questions to prepare for.</p>
                  <button className="btn ai" onClick={coach}>Coach me</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

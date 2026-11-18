'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type Insight, type Job, type Match } from '@/lib/api';
import { useApp } from '@/components/Providers';
import { AiTag, Bar, CompanyLogo, Pipeline, ScoreRing, SkillChips, StatusPill, Thinking, salary, scoreTone, timeAgo } from '@/components/ui';

type Detail = {
  job: Job; match?: Match; saved?: boolean; hasCv?: boolean;
  application?: { id: number; status: string; created_at: string; events: { status: string; created_at: string }[] } | null;
  invite?: { message: string; created_at: string } | null;
};

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading, toast } = useApp();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [letter, setLetter] = useState('');
  const [letterMeta, setLetterMeta] = useState<any>();
  const [writing, setWriting] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [thinking, setThinking] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => api<Detail>(`/jobs/${id}`).then(setD).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { if (!loading) load(); }, [load, loading, user]);

  async function writeLetter(regenerate = false) {
    setWriting(true);
    try {
      const r = await api<{ letter: string; _ai: any }>(`/jobs/${id}/cover-letter`, { body: { regenerate } });
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
      toast('Application sent! The employer can see your CV now.');
      await load();
    } catch (e: any) { toast(e.message, 'error'); }
    setApplying(false);
  }

  async function toggleSave() {
    const r = await api<{ saved: boolean }>(`/jobs/${id}/save`, { method: 'POST' });
    setD((x) => x && { ...x, saved: r.saved });
    toast(r.saved ? 'Saved for later' : 'Removed from saved');
  }

  if (err) return <div className="page narrow"><h1>Job not found</h1><p className="muted">{err}</p><Link className="btn" href="/jobs">Back to jobs</Link></div>;
  if (!d) return <div className="page"><div className="skeleton" style={{ height: 320 }} /></div>;
  const { job, match, application } = d;
  const isCandidate = user?.role === 'candidate';

  return (
    <div className="page">
      <p><Link href="/jobs" className="muted small">← All jobs</Link></p>
      <div className="grid-2">
        <div className="stack">
          <div className="card">
            <div className="job-hero">
              <CompanyLogo name={job.company.name} color={job.company.color} size={60} />
              <div className="grow">
                <h1>{job.title}</h1>
                <p className="muted" style={{ margin: 0 }}>{job.company.name} · {job.remote ? 'Remote' : job.location} · posted {timeAgo(job.created_at)}</p>
              </div>
            </div>
            <div className="tags" style={{ margin: '16px 0' }}>
              <span className="tag cap">{job.level}</span><span className="tag">{job.type}</span>
              {salary(job) && <span className="tag">{salary(job)}</span>}
              <span className="tag">{job.applicants} applicants</span>
              <span className="tag">{job.views} views</span>
              {job.status === 'closed' && <span className="tag tag-accent">Closed</span>}
            </div>
            <p>{job.description}</p>
            {job.responsibilities?.length > 0 && (<><h3>What you&apos;ll do</h3><ul className="tidy">{job.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></>)}
            <h3 style={{ marginTop: 18 }}>Required skills</h3>
            <div className="chips">{job.requirements.map((s) => <span key={s} className={`chip ${match ? (match.matched.includes(s) ? 'ok' : match.partial.includes(s) ? 'part' : 'miss') : ''}`}>{s}</span>)}</div>
            {job.nice_to_have?.length > 0 && (<><h3 style={{ marginTop: 16 }}>Nice to have</h3><div className="chips">{job.nice_to_have.map((s) => <span key={s} className="chip">{s}</span>)}</div></>)}
          </div>

          {job.company.about && (
            <div className="card">
              <h3>About {job.company.name}</h3>
              <p className="muted" style={{ margin: 0 }}>{job.company.about}</p>
              <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>{job.company.industry} · {job.company.size} employees · {job.company.location}</p>
            </div>
          )}

          {isCandidate && d.hasCv && !application && (
            <div className="card ai-panel">
              <div className="card-title"><h2>Cover letter</h2><AiTag meta={letterMeta} /></div>
              {writing ? <Thinking text="Writing your cover letter" /> : letter ? (
                <textarea className="input letter" rows={12} value={letter} onChange={(e) => setLetter(e.target.value)} aria-label="Cover letter" />
              ) : <p className="muted">Let the AI agent write a cover letter from your CV, tailored to this job. You can edit it before applying.</p>}
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn ai" onClick={() => writeLetter(!!letter)} disabled={writing}>✦ {letter ? 'Rewrite' : 'Write my cover letter'}</button>
                <button className="btn accent" onClick={apply} disabled={applying || job.status === 'closed'}>{applying ? 'Sending…' : letter ? 'Apply with this letter' : 'Apply with CV only'}</button>
              </div>
            </div>
          )}
        </div>

        <div className="stack sticky">
          {!user && !loading && (
            <div className="card">
              <h3>See how well you match</h3>
              <p className="muted">Create a free profile and our AI agent will score this job against your CV.</p>
              <Link href="/register" className="btn accent">Get my match score</Link>
            </div>
          )}

          {d.invite && !application && (
            <div className="card invite">
              <p className="eyebrow">You&apos;re invited</p>
              <p style={{ margin: 0 }}>{d.invite.message}</p>
              <p className="muted small" style={{ margin: '6px 0 0' }}>{timeAgo(d.invite.created_at)}</p>
            </div>
          )}

          {isCandidate && match && (
            <div className="card">
              <div className="match-big">
                <ScoreRing score={match.score} size={84} />
                <div>
                  <h2 style={{ margin: 0 }}>{match.label}</h2>
                  <p className="muted small" style={{ margin: 0 }}>{match.matched.length} of {job.requirements.length} required skills</p>
                </div>
              </div>
              <div className="breakdown">
                <div><span>Skills</span><Bar value={match.breakdown.skills} tone={scoreTone(match.breakdown.skills)} /><b>{match.breakdown.skills}</b></div>
                <div><span>Experience text</span><Bar value={match.breakdown.text} tone={scoreTone(match.breakdown.text)} /><b>{match.breakdown.text}</b></div>
                <div><span>Seniority fit</span><Bar value={match.breakdown.level} tone={scoreTone(match.breakdown.level)} /><b>{match.breakdown.level}</b></div>
              </div>
              <SkillChips match={match} />
              <ul className="tidy small muted" style={{ marginTop: 12 }}>{match.reasons.map((r) => <li key={r}>{r}</li>)}</ul>

              {!d.hasCv ? (
                <Link href="/candidate/profile" className="btn accent" style={{ marginTop: 14 }}>Create your CV to apply</Link>
              ) : application ? (
                <div style={{ marginTop: 16 }}>
                  <div className="row between"><b>Your application</b><StatusPill status={application.status} /></div>
                  <div style={{ marginTop: 12 }}><Pipeline status={application.status} /></div>
                  <ul className="list-plain small muted" style={{ marginTop: 12 }}>
                    {application.events.map((e, i) => <li key={i}><span className="grow">{e.status}</span><span>{timeAgo(e.created_at)}</span></li>)}
                  </ul>
                </div>
              ) : (
                <div className="row" style={{ marginTop: 16 }}>
                  <button className="btn accent" onClick={apply} disabled={applying || job.status === 'closed'}>Quick apply</button>
                  <button className="btn" onClick={toggleSave}>{d.saved ? '★ Saved' : '☆ Save'}</button>
                </div>
              )}
            </div>
          )}

          {isCandidate && d.hasCv && (
            <div className="card ai-panel">
              <div className="card-title"><h3>AI career coach</h3><AiTag meta={insight?._ai} /></div>
              {thinking ? <Thinking text="Comparing your CV with this job" /> : insight ? (
                <div className="stack small">
                  <p style={{ margin: 0 }}>{insight.summary}</p>
                  <div><b>How to close the gap</b><ul className="tidy">{insight.tips.map((t) => <li key={t}>{t}</li>)}</ul></div>
                  <div><b>Prepare for these questions</b><ul className="tidy">{insight.questions.map((t) => <li key={t}>{t}</li>)}</ul></div>
                </div>
              ) : (
                <>
                  <p className="muted small">Get a personal breakdown: what makes you a fit, what&apos;s missing, and the interview questions to prepare.</p>
                  <button className="btn ai" onClick={coach}>✦ Coach me for this job</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

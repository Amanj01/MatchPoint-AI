'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type CV, type Insight, type Job, type Match } from '@/lib/api';
import { RequireRole, useApp } from '@/components/Providers';
import { CVDocument } from '@/components/CVDocument';
import { AiTag, Avatar, Bar, Empty, Modal, Pipeline, ScoreRing, SkillChips, STAGES, StatusPill, Thinking, scoreTone, timeAgo } from '@/components/ui';

type Card = {
  id: number; name: string; avatar_color: string; headline: string; location: string; years_experience: number; has_cv: boolean; match: Match;
  application?: { id: number; status: string; created_at: string; cover_letter: string; employer_note: string; source: string };
  invited?: boolean;
};
type Data = { job: Job; applicants: Card[]; recommended: Card[] };
type Full = { candidate: { id: number; name: string }; cv: CV; match: Match; application: Card['application'] | null };

const STATUS_OPTIONS = [...STAGES, 'rejected'] as const;

function Review() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useApp();
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<'applicants' | 'recommended'>('applicants');
  const [stage, setStage] = useState('all');
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(() => api<Data>(`/employer/jobs/${id}/candidates`).then(setD).catch((e) => toast(e.message, 'error')), [id, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const c = Number(new URLSearchParams(location.search).get('candidate'));
    if (c) setOpen(c);
  }, []);

  async function setStatus(appId: number, status: string) {
    await api(`/employer/applications/${appId}`, { method: 'PATCH', body: { status } });
    toast(`Moved to ${status}. The candidate has been notified.`);
    load();
  }

  async function invite(userId: number, name: string) {
    await api(`/employer/jobs/${id}/invite/${userId}`, { body: {} });
    toast(`Invitation sent to ${name}`);
    load();
  }

  if (!d) return <div className="page"><div className="skeleton" style={{ height: 400 }} /></div>;
  const counts = Object.fromEntries(STATUS_OPTIONS.map((s) => [s, d.applicants.filter((a) => a.application?.status === s).length]));
  const list = tab === 'applicants'
    ? d.applicants.filter((a) => stage === 'all' || a.application?.status === stage)
    : d.recommended;

  return (
    <div className="page">
      <p><Link href="/employer" className="muted small">← Dashboard</Link></p>
      <div className="page-head">
        <div>
          <h1>{d.job.title}</h1>
          <p className="muted">{d.job.level} · {d.job.remote ? 'Remote' : d.job.location} · posted {timeAgo(d.job.created_at)} · {d.job.views} views</p>
          <div className="chips" style={{ marginTop: 8 }}>{d.job.requirements.map((s) => <span key={s} className="chip">{s}</span>)}</div>
        </div>
        <div className="row">
          <Link href={`/jobs/${d.job.id}`} className="btn">View public post</Link>
          <Link href={`/employer/jobs/${d.job.id}/edit`} className="btn">Edit</Link>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button className={tab === 'applicants' ? 'on' : ''} onClick={() => setTab('applicants')}>Applied<span className="count">{d.applicants.length}</span></button>
        <button className={tab === 'recommended' ? 'on' : ''} onClick={() => setTab('recommended')}>✦ Recommended by AI<span className="count">{d.recommended.length}</span></button>
      </div>

      {tab === 'applicants' && d.applicants.length > 0 && (
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="segmented">
            <button className={stage === 'all' ? 'on' : ''} onClick={() => setStage('all')}>All</button>
            {STATUS_OPTIONS.map((s) => counts[s] > 0 && (
              <button key={s} className={stage === s ? 'on' : ''} onClick={() => setStage(s)} style={{ textTransform: 'capitalize' }}>{s === 'rejected' ? 'Not selected' : s} {counts[s]}</button>
            ))}
          </div>
        </div>
      )}
      {tab === 'recommended' && <p className="muted small">Candidates who are open to work and fit this role, but haven&apos;t applied yet. Invite them and they get a notification.</p>}

      {list.length === 0 ? (
        <Empty title={tab === 'applicants' ? 'No applicants yet' : 'No strong matches right now'}>
          <p>{tab === 'applicants' ? 'Check the recommended tab and invite people who fit.' : 'Try loosening the required skills.'}</p>
        </Empty>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {list.map((c, rank) => (
            <div key={c.id} className="person" style={{ flexWrap: 'wrap' }}>
              <span className="muted small" style={{ width: 20 }}>#{rank + 1}</span>
              <Avatar name={c.name} color={c.avatar_color} size={42} />
              <button className="grow" style={{ textAlign: 'left', background: 'none', border: 0, cursor: 'pointer', padding: 0, minWidth: 200 }} onClick={() => setOpen(c.id)}>
                <h3>{c.name} {c.application?.source === 'invited' && <span className="tag tag-accent">invited</span>}</h3>
                <p className="muted small">{c.headline} · {c.years_experience} yrs · {c.location}{c.application ? ` · applied ${timeAgo(c.application.created_at)}` : ''}</p>
                <div style={{ marginTop: 6 }}><SkillChips match={c.match} compact /></div>
              </button>
              {c.application ? (
                <select className="input" style={{ width: 150 }} value={c.application.status} onChange={(e) => setStatus(c.application!.id, e.target.value)} aria-label={`Status for ${c.name}`}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'rejected' ? 'Not selected' : s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
              ) : c.invited ? <span className="pill status-shortlisted">Invited</span> : (
                <button className="btn accent sm" onClick={() => invite(c.id, c.name)}>Invite to apply</button>
              )}
              <button className="btn sm" onClick={() => setOpen(c.id)}>View CV</button>
              <ScoreRing score={c.match.score} size={50} />
            </div>
          ))}
        </div>
      )}

      <Modal open={open !== null} onClose={() => setOpen(null)} wide>
        {open !== null && <CandidatePanel jobId={Number(id)} userId={open} onStatus={setStatus} onInvite={invite} />}
      </Modal>
    </div>
  );
}

function CandidatePanel({ jobId, userId, onStatus, onInvite }: { jobId: number; userId: number; onStatus: (appId: number, s: string) => Promise<void>; onInvite: (id: number, name: string) => Promise<void> }) {
  const { toast } = useApp();
  const [full, setFull] = useState<Full | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [thinking, setThinking] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    api<Full>(`/employer/candidates/${userId}?job=${jobId}`).then((f) => { setFull(f); setNote(f.application?.employer_note || ''); }).catch((e) => toast(e.message, 'error'));
  }, [jobId, userId, toast]);

  async function analyse() {
    setThinking(true);
    try { setInsight(await api<Insight>(`/employer/jobs/${jobId}/insight/${userId}`, { body: {} })); } catch (e: any) { toast(e.message, 'error'); }
    setThinking(false);
  }

  async function saveNote() {
    await api(`/employer/applications/${full!.application!.id}`, { method: 'PATCH', body: { employer_note: note } });
    toast('Note saved (only your team sees it)');
  }

  if (!full) return <div className="modal-body"><div className="skeleton" style={{ height: 400 }} /></div>;
  const m = full.match;

  return (
    <div className="modal-body">
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        <div style={{ minWidth: 0 }}><CVDocument cv={full.cv} /></div>
        <div className="stack">
          <div className="card">
            <div className="match-big">
              <ScoreRing score={m.score} size={76} />
              <div><h2 style={{ margin: 0 }}>{m.label}</h2><p className="muted small" style={{ margin: 0 }}>for this job</p></div>
            </div>
            <div className="breakdown">
              <div><span>Skills</span><Bar value={m.breakdown.skills} tone={scoreTone(m.breakdown.skills)} /><b>{m.breakdown.skills}</b></div>
              <div><span>Experience text</span><Bar value={m.breakdown.text} tone={scoreTone(m.breakdown.text)} /><b>{m.breakdown.text}</b></div>
              <div><span>Seniority fit</span><Bar value={m.breakdown.level} tone={scoreTone(m.breakdown.level)} /><b>{m.breakdown.level}</b></div>
            </div>
            <SkillChips match={m} />
          </div>

          {full.application ? (
            <div className="card">
              <div className="row between"><b>Application</b><StatusPill status={full.application.status} /></div>
              <div style={{ margin: '12px 0' }}><Pipeline status={full.application.status} /></div>
              <div className="row">
                {full.application.status !== 'hired' && full.application.status !== 'rejected' && (
                  <button className="btn accent sm" onClick={async () => {
                    const next = STAGES[STAGES.indexOf(full.application!.status as any) + 1];
                    await onStatus(full.application!.id, next);
                    setFull({ ...full, application: { ...full.application!, status: next } });
                  }}>Move to {STAGES[STAGES.indexOf(full.application.status as any) + 1]}</button>
                )}
                {full.application.status !== 'rejected' && (
                  <button className="btn sm" onClick={async () => { await onStatus(full.application!.id, 'rejected'); setFull({ ...full, application: { ...full.application!, status: 'rejected' } }); }}>Not a fit</button>
                )}
              </div>
              {full.application.cover_letter && (
                <details style={{ marginTop: 12 }}><summary className="btn-link">Cover letter</summary><p className="letter small" style={{ marginTop: 8 }}>{full.application.cover_letter}</p></details>
              )}
              <label className="field" style={{ marginTop: 12 }}>Private note
                <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="Only your team sees this" />
              </label>
            </div>
          ) : (
            <div className="card"><p className="small" style={{ marginTop: 0 }}>{full.candidate.name} hasn&apos;t applied yet.</p><button className="btn accent sm" onClick={() => onInvite(userId, full.candidate.name)}>Invite to apply</button></div>
          )}

          <div className="card ai-panel">
            <div className="card-title"><h3>AI hiring assistant</h3><AiTag meta={insight?._ai} /></div>
            {thinking ? <Thinking text="Reading the CV" /> : insight ? (
              <div className="stack small">
                <p style={{ margin: 0 }}>{insight.summary}</p>
                <div><b>Strengths</b><ul className="tidy">{insight.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
                <div><b>Watch out for</b><ul className="tidy">{insight.concerns.map((s) => <li key={s}>{s}</li>)}</ul></div>
                <div><b>Interview questions</b><ol className="tidy">{insight.questions.map((s) => <li key={s}>{s}</li>)}</ol></div>
                <div><b>Suggestions</b><ul className="tidy">{insight.tips.map((s) => <li key={s}>{s}</li>)}</ul></div>
              </div>
            ) : (
              <>
                <p className="muted small">Get a fit summary, risks, and tailored interview questions for this candidate.</p>
                <button className="btn ai" onClick={analyse}>✦ Analyse this candidate</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireRole role="employer"><Review /></RequireRole>;
}

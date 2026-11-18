'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, type CV, type Insight, type Job, type Match } from '@/lib/api';
import { RequireRole, useApp } from '@/components/Providers';
import { CVDocument } from '@/components/CVDocument';
import { AiTag, Avatar, Drawer, Empty, MatchBadge, Pipeline, STAGES, SkillChips, StatusPill, Thinking, statusLabel, timeAgo } from '@/components/ui';

type Card = {
  id: number; name: string; avatar_color: string; avatar_url?: string | null; headline: string; location: string; years_experience: number; has_cv: boolean; match: Match;
  application?: { id: number; status: string; created_at: string; cover_letter: string; employer_note: string; source: string };
  invited?: boolean;
};
type Data = { job: Job; applicants: Card[]; recommended: Card[] };
type Full = { candidate: { id: number; name: string; avatar_color: string; avatar_url?: string | null }; cv: CV; match: Match; application: Card['application'] | null };

const COLUMNS = [...STAGES, 'rejected'] as const;

function Review() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useApp();
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<'pipeline' | 'recommended'>('pipeline');
  const [open, setOpen] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const load = useCallback(() => api<Data>(`/employer/jobs/${id}/candidates`).then(setD).catch((e) => toast(e.message, 'error')), [id, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const c = Number(new URLSearchParams(location.search).get('candidate'));
    if (c) setOpen(c);
  }, []);

  const setStatus = useCallback(async (appId: number, status: string, name?: string) => {
    // Optimistic: move the card right away, then save.
    setD((x) => x && { ...x, applicants: x.applicants.map((a) => (a.application?.id === appId ? { ...a, application: { ...a.application!, status } } : a)) });
    try {
      await api(`/employer/applications/${appId}`, { method: 'PATCH', body: { status } });
      toast(`${name ? `${name} moved to` : 'Moved to'} ${statusLabel(status).toLowerCase()}. They've been notified.`);
    } catch (e: any) { toast(e.message, 'error'); load(); }
  }, [toast, load]);

  async function invite(userId: number, name: string) {
    await api(`/employer/jobs/${id}/invite/${userId}`, { body: {} });
    toast(`Invitation sent to ${name}`);
    load();
  }

  if (!d) return <div className="page"><div className="skeleton" style={{ height: 400 }} /></div>;

  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <p style={{ marginBottom: 16 }}><Link href="/employer" className="muted small">← Dashboard</Link></p>
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h1>{d.job.title}</h1>
          <p className="muted"><span style={{ textTransform: 'capitalize' }}>{d.job.level}</span> · {d.job.remote ? 'Remote' : d.job.location} · posted {timeAgo(d.job.created_at)} · {d.job.views} views</p>
        </div>
        <div className="row">
          <Link href={`/jobs/${d.job.id}`} className="btn">View post</Link>
          <Link href={`/employer/jobs/${d.job.id}/edit`} className="btn">Edit</Link>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button className={tab === 'pipeline' ? 'on' : ''} onClick={() => setTab('pipeline')}>Pipeline<span className="count">{d.applicants.length}</span></button>
        <button className={tab === 'recommended' ? 'on' : ''} onClick={() => setTab('recommended')}>Recommended<span className="count">{d.recommended.length}</span></button>
      </div>

      {tab === 'pipeline' ? (
        d.applicants.length === 0 ? (
          <Empty title="No applicants yet"><p>Check the Recommended tab and invite people who fit.</p></Empty>
        ) : (
          <>
            <p className="label" style={{ margin: '-6px 0 14px' }}>Drag to move · click to open</p>
            <div className="kanban">
              {COLUMNS.map((col) => {
                const people = d.applicants.filter((a) => a.application?.status === col).sort((a, b) => b.match.score - a.match.score);
                return (
                  <div
                    key={col}
                    className={`kcol ${over === col ? 'over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setOver(col); }}
                    onDragLeave={() => setOver((o) => (o === col ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault(); setOver(null);
                      const card = d.applicants.find((a) => a.application?.id === dragging);
                      if (card && card.application!.status !== col) setStatus(card.application!.id, col, card.name.split(' ')[0]);
                      setDragging(null);
                    }}
                  >
                    <div className="kcol-head"><span>{statusLabel(col)}</span><span className="count" style={{ margin: 0 }}>{people.length}</span></div>
                    {people.map((c) => (
                      <div
                        key={c.id}
                        className={`kcard ${dragging === c.application!.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={(e) => { setDragging(c.application!.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragEnd={() => { setDragging(null); setOver(null); }}
                        onClick={() => setOpen(c.id)}
                        role="button" tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setOpen(c.id)}
                      >
                        <div className="who-line">
                          <Avatar name={c.name} color={c.avatar_color} src={c.avatar_url} size={34} />
                          <div className="grow"><b>{c.name}</b></div>
                          <span className="muted small" style={{ fontWeight: 600 }}>{c.match.score}%</span>
                        </div>
                      </div>
                    ))}
                    {people.length === 0 && <div className="kcol-empty">Drop here</div>}
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : d.recommended.length === 0 ? (
        <Empty title="No strong matches right now"><p>Try loosening the required skills.</p></Empty>
      ) : (
        <>
          <p className="label" style={{ margin: '-6px 0 8px' }}>Good fits who haven't applied yet</p>
          <div className="list">
            {d.recommended.map((c) => (
              <div key={c.id} className="list-row" onClick={() => setOpen(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(c.id)}>
                <Avatar name={c.name} color={c.avatar_color} src={c.avatar_url} size={48} />
                <div className="grow">
                  <h3>{c.name}</h3>
                  <p className="meta"><span>{c.headline.split(' · ')[0]}</span></p>
                </div>
                <div className="side">
                  <MatchBadge score={c.match.score} />
                  {c.invited ? <span className="pill status-shortlisted">Invited</span> : (
                    <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); invite(c.id, c.name); }}>Invite</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Drawer open={open !== null} onClose={() => setOpen(null)}>
        {open !== null && (
          <CandidatePanel
            key={open}
            jobId={Number(id)}
            userId={open}
            onStatus={async (appId, s) => { await setStatus(appId, s); }}
            onInvite={invite}
          />
        )}
      </Drawer>
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
    toast('Note saved. Only your team sees it.');
  }
  async function move(status: string) {
    await onStatus(full!.application!.id, status);
    setFull({ ...full!, application: { ...full!.application!, status } });
  }

  if (!full) return <div className="drawer-body"><div className="skeleton" style={{ height: 500 }} /><div /></div>;
  const m = full.match;
  const app = full.application;
  const next = app ? STAGES[STAGES.indexOf(app.status as any) + 1] : undefined;

  return (
    <>
      <div className="drawer-body" style={{ paddingTop: 28 }}>
        <div style={{ minWidth: 0 }}>
          <div className="hello" style={{ marginBottom: 24 }}>
            <Avatar name={full.candidate.name} color={full.candidate.avatar_color} src={full.candidate.avatar_url} size={64} />
            <div className="grow">
              <h2 style={{ margin: 0 }}>{full.candidate.name}</h2>
              <p className="muted" style={{ margin: 0 }}>{full.cv.headline}</p>
            </div>
            <MatchBadge score={m.score} />
          </div>
          <div style={{ marginBottom: 20 }}><SkillChips match={m} /></div>
          <CVDocument cv={full.cv} />
        </div>

        <div className="stack" style={{ position: 'sticky', top: 90 }}>
          {app ? (
            <div className="panel">
              <div className="row between"><h3 style={{ margin: 0 }}>Application</h3><StatusPill status={app.status} /></div>
              <div style={{ margin: '14px 0' }}><Pipeline status={app.status} /></div>
              <div className="row">
                {next && app.status !== 'rejected' && <button className="btn primary sm" onClick={() => move(next)}>Move to {statusLabel(next).toLowerCase()}</button>}
                {app.status !== 'rejected' && app.status !== 'hired' && <button className="btn sm outline" onClick={() => move('rejected')}>Not a fit</button>}
              </div>
              {app.cover_letter && <details style={{ marginTop: 14 }}><summary className="btn-link small">Cover letter</summary><p className="letter small" style={{ marginTop: 8 }}>{app.cover_letter}</p></details>}
              <label className="field" style={{ marginTop: 14 }}>Private note
                <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="Only your team sees this" />
              </label>
            </div>
          ) : (
            <div className="panel lime">
              <p style={{ marginTop: 0 }}>{full.candidate.name.split(' ')[0]} hasn&apos;t applied yet.</p>
              <button className="btn primary sm" onClick={() => onInvite(userId, full.candidate.name)}>Invite to apply</button>
            </div>
          )}

          <div className="panel">
            <div className="row between"><h3 style={{ margin: 0 }}>Interview prep</h3><AiTag meta={insight?._ai} /></div>
            {thinking ? <Thinking text="Reading the CV" /> : insight ? (
              <div className="stack small" style={{ marginTop: 10 }}>
                <p style={{ margin: 0 }}>{insight.summary}</p>
                <div><b>Strengths</b><ul className="tidy">{insight.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
                <div><b>Watch out for</b><ul className="tidy">{insight.concerns.map((s) => <li key={s}>{s}</li>)}</ul></div>
                <div><b>Questions to ask</b><ol className="tidy">{insight.questions.map((s) => <li key={s}>{s}</li>)}</ol></div>
              </div>
            ) : (
              <>
                <p className="muted small" style={{ marginTop: 8 }}>A short fit summary, risks, and tailored interview questions.</p>
                <button className="btn ai" onClick={analyse}>Prepare interview</button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <RequireRole role="employer"><Review /></RequireRole>;
}

'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type CV } from '@/lib/api';
import { RequireRole, useApp } from '@/components/Providers';
import { CVDocument } from '@/components/CVDocument';
import { Empty, timeAgo } from '@/components/ui';

type Row = { content: CV; template: string; ai_mode: string; updated_at: string };

function MyCv() {
  const { toast } = useApp();
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ headline: '', summary: '' });

  useEffect(() => { api<{ cv: Row | null }>('/me/cv').then((d) => setRow(d.cv)); }, []);

  async function patch(body: Record<string, string>) {
    const d = await api<{ cv: Row }>('/me/cv', { method: 'PATCH', body });
    setRow(d.cv);
  }

  if (row === undefined) return <div className="page"><div className="skeleton" style={{ height: 500 }} /></div>;
  if (row === null) return (
    <div className="page narrow">
      <Empty title="You don’t have a CV yet">
        <p>Fill in your profile and the AI agent will write it for you in seconds.</p>
        <Link href="/candidate/profile" className="btn ai">Create my CV</Link>
      </Empty>
    </div>
  );

  return (
    <div className="page">
      <div className="page-head no-print">
        <div>
          <h1>My CV</h1>
          <p className="muted">Written by the {row.ai_mode === 'gemini' ? 'Gemini' : 'demo'} AI agent · updated {timeAgo(row.updated_at)}</p>
        </div>
        <div className="row">
          <div className="segmented" aria-label="Template">
            {['modern', 'classic', 'compact'].map((t) => (
              <button key={t} className={row.template === t ? 'on' : ''} onClick={() => patch({ template: t })} style={{ textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
          <button className="btn" onClick={() => { setDraft({ headline: row.content.headline, summary: row.content.summary }); setEditing(!editing); }}>{editing ? 'Close editor' : 'Edit text'}</button>
          <Link href="/candidate/profile" className="btn">Update profile</Link>
          <button className="btn primary" onClick={() => window.print()}>Download PDF</button>
        </div>
      </div>

      {editing && (
        <div className="panel no-print stack" style={{ marginBottom: 20 }}>
          <label className="field">Headline<input className="input" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} /></label>
          <label className="field">Summary<textarea className="input" rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
          <div><button className="btn primary" onClick={async () => { await patch(draft); setEditing(false); toast('CV updated'); }}>Save changes</button></div>
        </div>
      )}

      {row.content.keywords?.length > 0 && (
        <div className="no-print" style={{ marginBottom: 20 }}>
          <div className="row"><b>ATS keywords in your CV</b><span className="muted small">Applicant tracking systems look for these</span></div>
          <div className="chips" style={{ marginTop: 8 }}>{row.content.keywords.map((k) => <span key={k} className="chip ok">{k}</span>)}</div>
        </div>
      )}

      <CVDocument cv={row.content} template={row.template} />
    </div>
  );
}

export default function Page() {
  return <RequireRole role="candidate"><MyCv /></RequireRole>;
}

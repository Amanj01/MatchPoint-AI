'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, type Job } from '@/lib/api';
import { useApp } from './Providers';
import { AiTag, TagInput, Thinking } from './ui';

type F = {
  title: string; level: string; location: string; remote: boolean; type: string; salary_min: string; salary_max: string;
  description: string; responsibilities: string[]; requirements: string[]; nice_to_have: string[]; status: string;
};

const fromJob = (j?: Job): F => ({
  title: j?.title || '', level: j?.level || 'junior', location: j?.location || '', remote: j?.remote || false, type: j?.type || 'Full-time',
  salary_min: j?.salary_min?.toString() || '', salary_max: j?.salary_max?.toString() || '', description: j?.description || '',
  responsibilities: j?.responsibilities || [], requirements: j?.requirements || [], nice_to_have: j?.nice_to_have || [], status: j?.status || 'open',
});

export function JobForm({ job }: { job?: Job }) {
  const { toast } = useApp();
  const router = useRouter();
  const [f, setF] = useState<F>(fromJob(job));
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [meta, setMeta] = useState<any>();
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((x) => ({ ...x, [k]: v }));

  async function draft() {
    setDrafting(true);
    try {
      const d = await api('/employer/jobs/draft', { body: { brief, regenerate: !!meta } });
      setF((x) => ({ ...x, title: d.title, level: d.level, description: d.description, responsibilities: d.responsibilities, requirements: d.requirements, nice_to_have: d.nice_to_have }));
      setMeta(d._ai);
    } catch (e: any) { toast(e.message, 'error'); }
    setDrafting(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = job ? await api(`/employer/jobs/${job.id}`, { method: 'PUT', body: f }) : await api('/employer/jobs', { body: f });
      toast(job ? 'Job updated' : 'Job published! The agent is already ranking candidates.');
      router.push(`/employer/jobs/${r.id}`);
    } catch (e: any) { toast(e.message, 'error'); setSaving(false); }
  }

  return (
    <div className="stack">
      {!job && (
        <div className="card ai-panel">
          <div className="card-title"><h2>Describe the role in a sentence</h2><AiTag meta={meta} /></div>
          <textarea className="input" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. We need a junior React developer who knows TypeScript and Tailwind to build our merchant dashboard in Erbil." aria-label="Role brief" />
          <div className="row" style={{ marginTop: 12 }}>
            {drafting ? <Thinking text="Drafting your job post" /> : <button className="btn ai" onClick={draft} disabled={brief.trim().length < 10}>✦ {meta ? 'Rewrite draft' : 'Write the job post'}</button>}
            <span className="muted small">You can edit everything below before publishing.</span>
          </div>
        </div>
      )}

      <form className="card stack" onSubmit={save}>
        <div className="form-grid">
          <label className="field full">Job title<input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} required /></label>
          <label className="field">Level
            <select className="input" value={f.level} onChange={(e) => set('level', e.target.value)}>
              <option value="intern">Intern</option><option value="junior">Junior</option><option value="mid">Mid-level</option><option value="senior">Senior</option>
            </select>
          </label>
          <label className="field">Type
            <select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>
              {['Full-time', 'Part-time', 'Internship', 'Contract'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">Location<input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Erbil" /></label>
          <label className="check" style={{ alignSelf: 'end', paddingBottom: 10 }}><input type="checkbox" checked={f.remote} onChange={(e) => set('remote', e.target.checked)} /> Remote friendly</label>
          <label className="field">Salary from (USD / month)<input className="input" type="number" value={f.salary_min} onChange={(e) => set('salary_min', e.target.value)} /></label>
          <label className="field">Salary to<input className="input" type="number" value={f.salary_max} onChange={(e) => set('salary_max', e.target.value)} /></label>
          <label className="field full">About the role<textarea className="input" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
          <label className="field full">Responsibilities <small>Press Enter after each one</small><TagInput value={f.responsibilities} onChange={(v) => set('responsibilities', v)} placeholder="Add a responsibility" /></label>
          <label className="field full">Required skills <small>Used to score and rank candidates</small><TagInput value={f.requirements} onChange={(v) => set('requirements', v)} placeholder="e.g. React" /></label>
          <label className="field full">Nice to have<TagInput value={f.nice_to_have} onChange={(v) => set('nice_to_have', v)} placeholder="e.g. Figma" /></label>
          {job && (
            <label className="field">Status
              <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="open">Open</option><option value="closed">Closed</option></select>
            </label>
          )}
        </div>
        <div className="row"><button className="btn accent lg" disabled={saving}>{saving ? 'Saving…' : job ? 'Save changes' : 'Publish job'}</button></div>
      </form>
    </div>
  );
}

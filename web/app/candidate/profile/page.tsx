'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RequireRole, useApp } from '@/components/Providers';
import { ScoreRing, TagInput, Thinking } from '@/components/ui';

type Exp = { title: string; company: string; start: string; end: string; description: string };
type Edu = { degree: string; school: string; start: string; end: string; details: string };
type Proj = { name: string; description: string; tech: string[] };
type P = {
  desired_role: string; location: string; phone: string; links: string; passion: string; years_experience: number;
  skills: string[]; experience: Exp[]; education: Edu[]; projects: Proj[]; languages: string[]; open_to_work: boolean;
};

const SKILL_SUGGESTIONS = ['JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'SQL', 'PostgreSQL', 'Docker', 'Git', 'Figma', 'Excel', 'PowerBI', 'Machine Learning', 'Flutter', 'Linux', 'Networking', 'Communication', 'Team Work', 'Problem Solving', 'Marketing', 'Social Media', 'Accounting', 'Customer Service', 'Leadership'];
const LANG_SUGGESTIONS = ['Kurdish (native)', 'Arabic', 'English', 'English (fluent)', 'Turkish', 'Persian', 'German', 'French'];

function Builder() {
  const { toast } = useApp();
  const router = useRouter();
  const [p, setP] = useState<P | null>(null);
  const [strength, setStrength] = useState({ percent: 0, todo: [] as string[] });
  const [hasCv, setHasCv] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api('/me/profile').then((d) => { setP(d.profile); setStrength(d.strength); setHasCv(d.hasCv); });
  }, []);
  if (!p) return <div className="page narrow"><div className="skeleton" style={{ height: 400 }} /></div>;

  const set = <K extends keyof P>(k: K, v: P[K]) => setP({ ...p, [k]: v });
  const setItem = <K extends 'experience' | 'education' | 'projects'>(k: K, i: number, patch: Partial<P[K][number]>) =>
    set(k, p[k].map((x, n) => (n === i ? { ...x, ...patch } : x)) as P[K]);
  const remove = (k: 'experience' | 'education' | 'projects', i: number) => set(k, p[k].filter((_, n) => n !== i) as any);

  async function save(quiet = false) {
    setSaving(true);
    try {
      const d = await api('/me/profile', { method: 'PUT', body: p });
      setStrength(d.strength);
      if (!quiet) toast('Profile saved');
      return true;
    } catch (e: any) { toast(e.message, 'error'); return false; } finally { setSaving(false); }
  }

  async function generate() {
    if (!(await save(true))) return;
    setGenerating(true);
    try {
      await api('/me/cv/generate', { body: { regenerate: hasCv } });
      toast('Your CV is ready!');
      router.push('/candidate/cv');
    } catch (e: any) { toast(e.message, 'error'); setGenerating(false); }
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>Tell the agent about you</h1>
          <p className="muted">Write naturally. No need to format anything; the AI agent turns this into a professional CV.</p>
        </div>
        <ScoreRing score={strength.percent} size={60} />
      </div>

      <div className="stack">
        <section className="card builder-section">
          <h2>The basics</h2>
          <div className="form-grid">
            <label className="field">Role you want<input className="input" value={p.desired_role} onChange={(e) => set('desired_role', e.target.value)} placeholder="e.g. Frontend Developer" /></label>
            <label className="field">Years of experience<input className="input" type="number" min={0} max={40} step={0.5} value={p.years_experience} onChange={(e) => set('years_experience', Number(e.target.value))} /></label>
            <label className="field">City<input className="input" value={p.location} onChange={(e) => set('location', e.target.value)} placeholder="Erbil" /></label>
            <label className="field">Phone<input className="input" value={p.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label className="field full">Links <small>LinkedIn, GitHub, portfolio</small><input className="input" value={p.links} onChange={(e) => set('links', e.target.value)} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={p.open_to_work} onChange={(e) => set('open_to_work', e.target.checked)} /> Open to work: let employers find and invite me</label>
        </section>

        <section className="card builder-section">
          <h2>Your passion</h2>
          <label className="field">What do you love doing, and what do you want next?
            <small>A few honest sentences. This becomes the heart of your CV summary.</small>
            <textarea className="input" rows={4} value={p.passion} onChange={(e) => set('passion', e.target.value)} placeholder="I love building apps that help small shops go online…" />
          </label>
        </section>

        <section className="card builder-section">
          <h2>Skills</h2>
          <TagInput value={p.skills} onChange={(v) => set('skills', v)} placeholder="Type a skill and press Enter" suggestions={SKILL_SUGGESTIONS} />
        </section>

        <section className="card builder-section">
          <div className="row between"><h2 style={{ margin: 0 }}>Experience</h2><button className="btn sm" onClick={() => set('experience', [...p.experience, { title: '', company: '', start: '', end: '', description: '' }])}>+ Add</button></div>
          {p.experience.length === 0 && <p className="muted small">Internships, part-time jobs and volunteering all count.</p>}
          {p.experience.map((e, i) => (
            <div key={i} className="repeat">
              <div className="repeat-head"><b>{e.title || 'New role'}</b><button className="btn ghost sm danger" onClick={() => remove('experience', i)}>Remove</button></div>
              <div className="form-grid">
                <input className="input" placeholder="Job title" value={e.title} onChange={(x) => setItem('experience', i, { title: x.target.value })} aria-label="Job title" />
                <input className="input" placeholder="Company" value={e.company} onChange={(x) => setItem('experience', i, { company: x.target.value })} aria-label="Company" />
                <input className="input" placeholder="Start (e.g. Mar 2024)" value={e.start} onChange={(x) => setItem('experience', i, { start: x.target.value })} aria-label="Start" />
                <input className="input" placeholder="End (blank = present)" value={e.end} onChange={(x) => setItem('experience', i, { end: x.target.value })} aria-label="End" />
                <textarea className="input full" placeholder="What did you do? Any results or numbers?" value={e.description} onChange={(x) => setItem('experience', i, { description: x.target.value })} aria-label="Description" />
              </div>
            </div>
          ))}
        </section>

        <section className="card builder-section">
          <div className="row between"><h2 style={{ margin: 0 }}>Projects</h2><button className="btn sm" onClick={() => set('projects', [...p.projects, { name: '', description: '', tech: [] }])}>+ Add</button></div>
          {p.projects.map((pr, i) => (
            <div key={i} className="repeat">
              <div className="repeat-head"><b>{pr.name || 'New project'}</b><button className="btn ghost sm danger" onClick={() => remove('projects', i)}>Remove</button></div>
              <input className="input" placeholder="Project name" value={pr.name} onChange={(x) => setItem('projects', i, { name: x.target.value })} aria-label="Project name" />
              <textarea className="input" placeholder="What is it and what did you build?" value={pr.description} onChange={(x) => setItem('projects', i, { description: x.target.value })} aria-label="Project description" />
              <TagInput value={pr.tech || []} onChange={(v) => setItem('projects', i, { tech: v })} placeholder="Tools used" />
            </div>
          ))}
        </section>

        <section className="card builder-section">
          <div className="row between"><h2 style={{ margin: 0 }}>Education</h2><button className="btn sm" onClick={() => set('education', [...p.education, { degree: '', school: '', start: '', end: '', details: '' }])}>+ Add</button></div>
          {p.education.map((ed, i) => (
            <div key={i} className="repeat">
              <div className="repeat-head"><b>{ed.degree || 'New degree'}</b><button className="btn ghost sm danger" onClick={() => remove('education', i)}>Remove</button></div>
              <div className="form-grid">
                <input className="input" placeholder="Degree" value={ed.degree} onChange={(x) => setItem('education', i, { degree: x.target.value })} aria-label="Degree" />
                <input className="input" placeholder="University / school" value={ed.school} onChange={(x) => setItem('education', i, { school: x.target.value })} aria-label="School" />
                <input className="input" placeholder="Start year" value={ed.start} onChange={(x) => setItem('education', i, { start: x.target.value })} aria-label="Start year" />
                <input className="input" placeholder="End year" value={ed.end} onChange={(x) => setItem('education', i, { end: x.target.value })} aria-label="End year" />
                <input className="input full" placeholder="Details (GPA, thesis, awards)" value={ed.details} onChange={(x) => setItem('education', i, { details: x.target.value })} aria-label="Details" />
              </div>
            </div>
          ))}
        </section>

        <section className="card builder-section">
          <h2>Languages</h2>
          <TagInput value={p.languages} onChange={(v) => set('languages', v)} placeholder="Add a language" suggestions={LANG_SUGGESTIONS} />
        </section>
      </div>

      <div className="save-bar">
        {generating ? <Thinking text="Writing your CV" /> : (
          <>
            <button className="btn" onClick={() => save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="btn ai lg" onClick={generate} disabled={saving}>✦ {hasCv ? 'Save & rewrite my CV' : 'Generate my CV with AI'}</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <RequireRole role="candidate"><Builder /></RequireRole>;
}

'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Job, Match } from '@/lib/api';

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export function salary(j: Pick<Job, 'salary_min' | 'salary_max' | 'currency'>) {
  if (!j.salary_min && !j.salary_max) return '';
  const f = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : String(n));
  return `$${f(j.salary_min || j.salary_max!)}${j.salary_max && j.salary_min ? `–${f(j.salary_max)}` : ''}/mo`;
}

export const scoreTone = (s: number) => (s >= 75 ? 'great' : s >= 55 ? 'good' : s >= 35 ? 'fair' : 'low');

export function ScoreRing({ score, size = 52, label = true }: { score: number; size?: number; label?: boolean }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <div className={`ring tone-${scoreTone(score)}`} style={{ width: size, height: size }} title={`Match score ${score}/100`}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-value" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      {label && <span style={{ fontSize: size * 0.3 }}>{score}</span>}
    </div>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <span className="avatar" style={{ background: color, width: size, height: size, fontSize: size * 0.38 }} aria-hidden>{initials}</span>;
}

export function CompanyLogo({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  return <span className="logo" style={{ background: color, width: size, height: size, fontSize: size * 0.42 }} aria-hidden>{name[0]}</span>;
}

const STATUS_LABEL: Record<string, string> = { applied: 'Applied', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Not selected' };
export function StatusPill({ status }: { status: string }) {
  return <span className={`pill status-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export const STAGES = ['applied', 'shortlisted', 'interview', 'offer', 'hired'] as const;

export function Pipeline({ status }: { status: string }) {
  const idx = STAGES.indexOf(status as any);
  return (
    <ol className={`pipeline ${status === 'rejected' ? 'is-rejected' : ''}`} aria-label={`Status: ${status}`}>
      {STAGES.map((s, i) => <li key={s} className={i <= idx ? 'done' : ''}><span />{STATUS_LABEL[s]}</li>)}
    </ol>
  );
}

export function SkillChips({ match, compact }: { match: Match; compact?: boolean }) {
  const n = compact ? 4 : 99;
  return (
    <div className="chips">
      {match.matched.slice(0, n).map((s) => <span key={s} className="chip ok" title="You have this">✓ {s}</span>)}
      {match.partial.slice(0, n).map((s) => <span key={s} className="chip part" title="Mentioned in your experience">~ {s}</span>)}
      {match.missing.slice(0, compact ? 2 : 99).map((s) => <span key={s} className="chip miss" title="Missing">{s}</span>)}
    </div>
  );
}

export function JobCard({ job, href }: { job: Job; href?: string }) {
  return (
    <Link href={href || `/jobs/${job.id}`} className="card job-card">
      <div className="job-card-top">
        <CompanyLogo name={job.company.name} color={job.company.color} />
        <div className="grow">
          <h3>{job.title}</h3>
          <p className="muted small">{job.company.name} · {job.remote ? 'Remote' : job.location}</p>
        </div>
        {job.match && <ScoreRing score={job.match.score} size={48} />}
      </div>
      <div className="tags">
        <span className="tag cap">{job.level}</span>
        <span className="tag">{job.type}</span>
        {salary(job) && <span className="tag">{salary(job)}</span>}
        {job.applied && <span className="tag tag-accent">Applied</span>}
      </div>
      {job.match ? <SkillChips match={job.match} compact /> : (
        <div className="chips">{job.requirements.slice(0, 4).map((s) => <span key={s} className="chip">{s}</span>)}</div>
      )}
      <p className="muted small job-card-foot">
        <span>{timeAgo(job.created_at)}</span>
        <span>{job.applicants} applicant{job.applicants === 1 ? '' : 's'}</span>
      </p>
    </Link>
  );
}

export function TagInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setText('');
  };
  const open = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()) && (!text || s.toLowerCase().includes(text.toLowerCase()))).slice(0, 8);
  return (
    <div>
      <div className="taginput">
        {value.map((v) => (
          <span key={v} className="chip ok">{v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button></span>
        ))}
        <input
          value={text}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) { e.preventDefault(); add(text); }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
      {open.length > 0 && (
        <div className="chips suggest">
          {open.map((s) => <button type="button" key={s} className="chip" onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}

/** Shows that a result came from the AI agent, and whether it was free (mock/cached). */
export function AiTag({ meta }: { meta?: { mode: string; cached: boolean } }) {
  if (!meta) return null;
  return <span className="ai-tag" title={meta.mode === 'mock' ? 'Offline demo agent (no API cost)' : 'Generated by Gemini'}>✦ {meta.mode === 'mock' ? 'Demo AI' : 'Gemini'}{meta.cached ? ' · cached' : ''}</span>;
}

export function Thinking({ text = 'The agent is thinking' }: { text?: string }) {
  const steps = ['Reading your profile', 'Comparing with the role', 'Writing', 'Polishing'];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % steps.length), 700); return () => clearInterval(t); }, []);
  return <div className="thinking"><span className="dots"><i /><i /><i /></span>{text}: {steps[i]}…</div>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children}</div>;
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
      {open && children}
    </dialog>
  );
}

export function Bar({ value, tone }: { value: number; tone?: string }) {
  return <div className="bar"><span className={tone ? `tone-${tone}` : ''} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>;
}

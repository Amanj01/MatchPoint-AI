'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

/** Unsplash image helper for decorative photos. */
export const photo = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`;

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

export function MatchBadge({ score }: { score: number }) {
  return <span className={`match ${scoreTone(score)}`} title="How well this matches the CV">{score}% match</span>;
}

export function Avatar({ name, color, src, size = 36 }: { name: string; color?: string; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img src={src} alt="" className="avatar" width={size} height={size} style={{ width: size, height: size }} onError={() => setBroken(true)} loading="lazy" />;
  }
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <span className="avatar" style={{ background: color || '#111', width: size, height: size, fontSize: size * 0.38 }} aria-hidden>{initials}</span>;
}

export function CompanyLogo({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  return <span className="logo" style={{ background: color, width: size, height: size, fontSize: size * 0.44, borderRadius: size * 0.28 }} aria-hidden>{name[0]}</span>;
}

/** Company photo as a small square, falling back to the logo. */
export function CompanyThumb({ company, size = 48 }: { company: Job['company']; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (company.cover && !broken) {
    return <img src={company.cover.replace('w=1200', 'w=160')} alt="" className="thumb" style={{ width: size, height: size }} onError={() => setBroken(true)} loading="lazy" />;
  }
  return <CompanyLogo name={company.name} color={company.color} size={size} />;
}

const STATUS_LABEL: Record<string, string> = { applied: 'Applied', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Not selected' };
export const statusLabel = (s: string) => STATUS_LABEL[s] || s;
export function StatusPill({ status }: { status: string }) {
  return <span className={`pill status-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export const STAGES = ['applied', 'shortlisted', 'interview', 'offer', 'hired'] as const;

export function Pipeline({ status }: { status: string }) {
  const idx = STAGES.indexOf(status as any);
  return (
    <ol className={`pipeline ${status === 'rejected' ? 'is-rejected' : ''}`} aria-label={`Status: ${status}`}>
      {STAGES.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'done current' : ''}><span />{STATUS_LABEL[s]}</li>)}
    </ol>
  );
}

export function SkillChips({ match, compact }: { match: Match; compact?: boolean }) {
  const n = compact ? 4 : 99;
  return (
    <div className="chips">
      {match.matched.slice(0, n).map((s) => <span key={s} className="chip ok" title="On your CV">✓ {s}</span>)}
      {match.partial.slice(0, n).map((s) => <span key={s} className="chip part" title="Mentioned in your experience">~ {s}</span>)}
      {match.missing.slice(0, compact ? 2 : 99).map((s) => <span key={s} className="chip miss" title="Missing">{s}</span>)}
    </div>
  );
}

/** One job as a list row. Used everywhere instead of cards. */
export function JobRow({ job, active, onSelect, href }: { job: Job; active?: boolean; onSelect?: () => void; href?: string }) {
  const inner = (
    <>
      <CompanyThumb company={job.company} size={52} />
      <div className="grow">
        <h3>{job.title}</h3>
        <p className="meta">
          <span>{job.company.name}</span>
          <span>{job.remote ? 'Remote' : job.location}</span>
        </p>
      </div>
      <div className="side">
        {job.match ? <MatchBadge score={job.match.score} /> : <span className="tag cap">{job.level}</span>}
        <span className="row-arrow" aria-hidden>→</span>
      </div>
    </>
  );
  if (onSelect) return <button type="button" className={`list-row ${active ? 'active' : ''}`} onClick={onSelect} aria-current={active}>{inner}</button>;
  return <Link href={href || `/jobs?job=${job.id}`} className="list-row">{inner}</Link>;
}

/** Keyword + city search. Sends people to the job board. */
export function SearchBar({ q = '', city = '', onSearch, cities }: { q?: string; city?: string; onSearch?: (q: string, city: string) => void; cities?: string[] }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const [where, setWhere] = useState(city);
  useEffect(() => { setText(q); }, [q]);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(text, where);
    else router.push(`/jobs?${new URLSearchParams({ ...(text ? { q: text } : {}), ...(where ? { city: where } : {}) })}`);
  };
  return (
    <form className="search" onSubmit={go} role="search">
      <label>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={text} onChange={(e) => { setText(e.target.value); onSearch?.(e.target.value, where); }} placeholder="Job title, skill or company" aria-label="Keyword" />
      </label>
      <label>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
        <select value={where} onChange={(e) => { setWhere(e.target.value); onSearch?.(text, e.target.value); }} aria-label="City">
          <option value="">Anywhere</option>
          {(cities || ['Erbil', 'Sulaymaniyah', 'Duhok', 'Baghdad', 'Basra', 'Remote']).map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <button className="btn primary">Search</button>
    </form>
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
          <span key={v} className="chip">{v}<button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button></span>
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
  return <span className="ai-tag" title={meta.mode === 'mock' ? 'Offline demo agent (no API cost)' : 'Generated by Gemini'}>{meta.mode === 'mock' ? 'Demo AI' : 'Gemini'}{meta.cached ? ' · cached' : ''}</span>;
}

export function Thinking({ text = 'Working' }: { text?: string }) {
  return <div className="thinking" role="status"><span className="spinner" aria-hidden />{text}…</div>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children}</div>;
}

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
      {open && children}
    </dialog>
  );
}

/** Slide-in panel from the right. Esc or backdrop click closes it. */
export function Drawer({ open, onClose, head, children }: { open: boolean; onClose: () => void; head?: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="grow">{head}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function Bar({ value, tone }: { value: number; tone?: string }) {
  return <div className="bar"><span className={tone ? `tone-${tone}` : ''} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>;
}

/** Counts up to a number on first render, for the stats rows. */
export function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const step = (t: number) => { const p = Math.min(1, (t - start) / 700); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RequireRole, useApp } from '@/components/Providers';
import { CompanyLogo } from '@/components/ui';

type Co = { name: string; industry: string; size: string; location: string; website: string; about: string; color: string };

function Company() {
  const { toast, refresh } = useApp();
  const [c, setC] = useState<Co | null>(null);
  useEffect(() => { api('/employer/dashboard').then((d) => setC(d.company)); }, []);
  if (!c) return <div className="page narrow"><div className="skeleton" style={{ height: 300 }} /></div>;
  const set = (k: keyof Co) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/employer/company', { method: 'PUT', body: c }); toast('Company profile saved'); refresh(); } catch (err: any) { toast(err.message, 'error'); }
  }

  return (
    <div className="page narrow">
      <div className="page-head"><div className="row"><CompanyLogo name={c.name} color={c.color} size={56} /><div><h1 style={{ margin: 0 }}>Company profile</h1><p className="muted">Candidates see this on every job you post.</p></div></div></div>
      <form className="card stack" onSubmit={save}>
        <div className="form-grid">
          <label className="field">Name<input className="input" value={c.name} onChange={set('name')} required /></label>
          <label className="field">Industry<input className="input" value={c.industry} onChange={set('industry')} /></label>
          <label className="field">Size<input className="input" value={c.size} onChange={set('size')} placeholder="11-50" /></label>
          <label className="field">Location<input className="input" value={c.location} onChange={set('location')} /></label>
          <label className="field full">Website<input className="input" value={c.website} onChange={set('website')} /></label>
          <label className="field full">About<textarea className="input" rows={4} value={c.about} onChange={set('about')} /></label>
        </div>
        <div><button className="btn primary">Save</button></div>
      </form>
    </div>
  );
}

export default function Page() {
  return <RequireRole role="employer"><Company /></RequireRole>;
}

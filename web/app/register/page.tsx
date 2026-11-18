'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';
import { useApp } from '@/components/Providers';

export default function Register() {
  const { setUser } = useApp();
  const router = useRouter();
  const [role, setRole] = useState<'candidate' | 'employer'>('candidate');
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', industry: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (new URLSearchParams(location.search).get('role') === 'employer') setRole('employer'); }, []);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { user } = await api<{ user: User }>('/auth/register', { body: { ...form, role } });
      setUser(user);
      router.push(role === 'candidate' ? '/candidate/profile' : '/employer/jobs/new');
    } catch (err: any) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="auth">
      <div className="card">
        <h1>Create your account</h1>
        <div className="segmented" role="tablist" style={{ margin: '8px 0 20px' }}>
          <button type="button" className={role === 'candidate' ? 'on' : ''} onClick={() => setRole('candidate')}>I&apos;m looking for a job</button>
          <button type="button" className={role === 'employer' ? 'on' : ''} onClick={() => setRole('employer')}>I&apos;m hiring</button>
        </div>
        <form className="stack" onSubmit={submit}>
          <label className="field">Full name<input className="input" value={form.name} onChange={set('name')} required autoComplete="name" /></label>
          {role === 'employer' && (
            <div className="form-grid">
              <label className="field">Company<input className="input" value={form.company} onChange={set('company')} required /></label>
              <label className="field">Industry<input className="input" value={form.industry} onChange={set('industry')} placeholder="e.g. Fintech" /></label>
            </div>
          )}
          <label className="field">Email<input className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
          <label className="field">Password <small>At least 6 characters</small><input className="input" type="password" value={form.password} onChange={set('password')} required minLength={6} autoComplete="new-password" /></label>
          {error && <p className="error-text">{error}</p>}
          <button className="btn accent lg" disabled={busy}>{busy ? 'Creating…' : role === 'candidate' ? 'Start building my CV' : 'Start hiring'}</button>
        </form>
        <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>Already have an account? <Link href="/login" className="btn-link">Log in</Link></p>
      </div>
    </div>
  );
}

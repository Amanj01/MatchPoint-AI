'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, type User } from '@/lib/api';
import { useApp } from '@/components/Providers';

export default function Login() {
  const { setUser } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e?: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const { user } = await api<{ user: User }>('/auth/login', { body: creds || { email, password } });
      setUser(user);
      const next = new URLSearchParams(location.search).get('next');
      router.push(next && next.startsWith('/') ? next : `/${user.role}`);
    } catch (err: any) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="auth">
      <div className="card">
        <h1>Welcome back</h1>
        <p className="muted">Log in to see your matches and applications.</p>
        <form className="stack" onSubmit={signIn}>
          <label className="field">Email<input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="field">Password<input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <p className="error-text">{error}</p>}
          <button className="btn primary lg" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        </form>
        <div className="demo-box">
          <b>Demo accounts</b> <span className="muted">(seeded data)</span><br />
          <button className="btn sm" disabled={busy} onClick={() => signIn(undefined, { email: 'candidate@matchpoint.demo', password: 'demo1234' })}>Job seeker: Aram</button>
          <button className="btn sm" disabled={busy} onClick={() => signIn(undefined, { email: 'hr@nova.demo', password: 'demo1234' })}>Employer: NovaPay</button>
        </div>
        <p className="muted small" style={{ marginTop: 16, marginBottom: 0 }}>New here? <Link href="/register" className="btn-link">Create an account</Link></p>
      </div>
    </div>
  );
}

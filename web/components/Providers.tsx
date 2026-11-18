'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
type Ctx = {
  user: User | null; loading: boolean;
  refresh: () => Promise<void>; setUser: (u: User | null) => void;
  toast: (text: string, kind?: 'ok' | 'error') => void;
};

const AppContext = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refresh = useCallback(async () => {
    try { setUser((await api<{ user: User | null }>('/auth/me')).user); } catch { setUser(null); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <AppContext.Provider value={{ user, loading, refresh, setUser, toast }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </AppContext.Provider>
  );
}

/** Redirect-free guard: shows a sign-in prompt instead of the page when the role doesn't match. */
export function RequireRole({ role, children }: { role: 'candidate' | 'employer'; children: React.ReactNode }) {
  const { user, loading } = useApp();
  if (loading) return <div className="page"><div className="skeleton" style={{ height: 220 }} /></div>;
  if (!user || user.role !== role) {
    return (
      <div className="page narrow center-text">
        <h1 className="display-sm">{role === 'candidate' ? 'For job seekers' : 'For employers'}</h1>
        <p className="muted">Sign in with a {role} account to see this page.</p>
        <p><a className="btn primary" href={`/login?next=${typeof window !== 'undefined' ? encodeURIComponent(location.pathname) : ''}`}>Sign in</a></p>
      </div>
    );
  }
  return <>{children}</>;
}

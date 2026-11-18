'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from './Providers';
import { Avatar, timeAgo } from './ui';
import { LogoMark } from './Logo';

type Note = { id: number; text: string; link: string; read: boolean; created_at: string };

export function Nav() {
  const { user, setUser, toast } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = () => api<{ items: Note[]; unread: number }>('/notifications').then((d) => {
      setUnread((prev) => {
        if (d.unread > prev && prev !== 0) toast(d.items[0]?.text || 'New notification');
        return d.unread;
      });
      setNotes(d.items);
    }).catch(() => {});
    load();
    const t = setInterval(load, 15000); // light polling keeps the bell live
    return () => clearInterval(t);
  }, [user, toast]);

  useEffect(() => { setOpen(false); setMenu(false); }, [path]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const links = !user
    ? [['/jobs', 'Find jobs'], ['/#employers', 'For employers'], ['/#how', 'How it works']]
    : user.role === 'candidate'
      ? [['/candidate', 'Dashboard'], ['/jobs', 'Jobs'], ['/candidate/profile', 'My profile'], ['/candidate/cv', 'My CV'], ['/candidate/applications', 'Applications']]
      : [['/employer', 'Dashboard'], ['/employer/jobs/new', 'Post a job'], ['/employer/company', 'Company'], ['/jobs', 'Job board']];

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
  }

  async function toggleBell() {
    setOpen((o) => !o);
    if (!open && unread) { await api('/notifications/read', { method: 'POST' }); setUnread(0); }
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href={user ? `/${user.role}` : '/'} className="brand" aria-label="MatchPoint home">
          <LogoMark />
          <span className="brand-word"><b>Match</b>point</span>
        </Link>

        <button className="nav-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
        <nav className={`nav-links ${menu ? 'open' : ''}`}>
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? 'active' : ''}>{label}</Link>
          ))}
          {user
            ? <button className="mobile-only nav-menu-btn" onClick={logout}>Log out</button>
            : <Link href="/login" className="mobile-only">Log in</Link>}
        </nav>

        <div className="nav-right">
          {user ? (
            <>
              <div className="bell-wrap" ref={boxRef}>
                <button className="icon-btn" onClick={toggleBell} aria-label={`Notifications (${unread} unread)`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                  {unread > 0 && <span className="badge-dot">{unread > 9 ? '9+' : unread}</span>}
                </button>
                {open && (
                  <div className="dropdown">
                    <p className="dropdown-title">Notifications</p>
                    {notes.length === 0 && <p className="muted small pad">Nothing yet.</p>}
                    {notes.slice(0, 12).map((n) => (
                      <Link key={n.id} href={n.link || '#'} className={`note ${n.read ? '' : 'unread'}`}>
                        <span>{n.text}</span><span className="muted small">{timeAgo(n.created_at)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <span className="who">
                <Avatar name={user.name} color={user.avatar_color} src={user.avatar_url} size={32} />
                <span className="who-text"><strong>{user.name.split(' ')[0]}</strong><small>{user.role === 'employer' ? user.company_name : 'Job seeker'}</small></span>
              </span>
              <button className="btn ghost sm" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn ghost sm">Log in</Link>
              <Link href="/register" className="btn primary sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

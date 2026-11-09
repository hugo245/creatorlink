'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Bell } from 'lucide-react';
import { markAllRead, markRead } from '@/app/actions/account';
import { timeAgo } from '@/lib/format';

export type Notif = { id: string; title: string; body: string; href: string | null; read_at: number | null; created_at: number };

export function NotificationBell({ items, unread }: { items: Notif[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="btn btn-ghost relative h-10 w-10 px-0" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell size={19} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-bold text-white tnum">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[340px] max-w-[calc(100vw-2rem)] animate-fade overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-bold">Notifications</p>
            {unread > 0 && <button onClick={() => start(() => markAllRead())} className="text-xs font-semibold text-signal hover:underline">Mark all read</button>}
          </div>
          <ul className="scroll-thin max-h-[360px] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-3">You’re all caught up.</li>}
            {items.map((n) => (
              <li key={n.id} className="border-b border-line last:border-0">
                <Link
                  href={n.href ?? '/app/notifications'}
                  onClick={() => { setOpen(false); if (!n.read_at) start(() => markRead(n.id)); }}
                  className={`flex gap-3 px-4 py-3 transition hover:bg-paper ${n.read_at ? '' : 'bg-signal-soft/40'}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-signal'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{n.title}</span>
                    {n.body && <span className="block truncate text-[13px] text-ink-3">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-ink-4">{timeAgo(n.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/app/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold hover:bg-paper">View all</Link>
        </div>
      )}
    </div>
  );
}

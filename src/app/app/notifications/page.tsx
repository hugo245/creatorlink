import Link from 'next/link';
import { Bell } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { EmptyState, PageHeader } from '@/components/ui';
import { timeAgo } from '@/lib/format';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await all<{ id: string; title: string; body: string; href: string | null; read_at: number | null; created_at: number }>('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', user.id);
  return (
    <>
      <PageHeader title="Notifications" />
      {items.length === 0 ? <EmptyState icon={<Bell size={22} />} title="You’re all caught up" /> : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.href ?? '/app'} className={`flex gap-4 px-5 py-4 transition hover:bg-paper ${n.read_at ? '' : 'bg-signal-soft/40'}`}>
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-signal'}`} />
                <div className="min-w-0 flex-1"><p className="font-semibold">{n.title}</p>{n.body && <p className="text-sm text-ink-3">{n.body}</p>}</div>
                <span className="text-xs text-ink-4">{timeAgo(n.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

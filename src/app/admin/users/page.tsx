import { all } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { PageHeader, Robux } from '@/components/ui';
import { dateShort } from '@/lib/format';
import { AdjustForm, BanButton } from '../forms';

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdmin();
  const q = ((await searchParams).q ?? '').replace(/[%_]/g, '').slice(0, 40);
  const rows = await all<{ id: string; username: string; email: string; role: string; balance: number; banned_at: number | null; created_at: number }>(
    `SELECT id, username, email, role, balance, banned_at, created_at FROM users WHERE lower(username) LIKE ? OR lower(email) LIKE ? ORDER BY created_at DESC LIMIT 100`, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`,
  );
  return (
    <>
      <PageHeader title="Users" />
      <form className="mb-5"><input name="q" defaultValue={q} placeholder="Search username or email" className="field max-w-sm" /></form>
      <div className="card divide-y divide-line">
        {rows.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-semibold">{u.username} {u.role === 'admin' && <span className="badge bg-ink text-paper">admin</span>} {u.banned_at && <span className="badge bg-signal-soft text-signal-dark">suspended</span>}</p>
              <p className="text-sm text-ink-3">{u.email} · joined {dateShort(u.created_at)} · <Robux n={u.balance} /></p>
            </div>
            {u.id !== me.id && <div className="flex flex-wrap items-center gap-3"><AdjustForm id={u.id} /><BanButton id={u.id} banned={!!u.banned_at} /></div>}
          </div>
        ))}
      </div>
    </>
  );
}

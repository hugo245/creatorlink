import { all } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { PageHeader, Money } from '@/components/ui';
import { dateShort } from '@/lib/format';
import { AdjustForm, BanButton, HoldButton, VerifyEmailButton } from '../forms';

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdmin();
  const q = ((await searchParams).q ?? '').replace(/[%_]/g, '').slice(0, 40).toLowerCase();
  const rows = await all<{ id: string; username: string; email: string; role: string; balance: number; balance_usd: number; banned_at: number | null; email_verified_at: number | null; payout_hold: number; created_at: number }>(
    `SELECT id, username, email, role, balance, balance_usd, banned_at, email_verified_at, payout_hold, created_at FROM users
      WHERE lower(username) LIKE ? OR lower(email) LIKE ? ORDER BY created_at DESC LIMIT 100`, `%${q}%`, `%${q}%`,
  );
  return (
    <>
      <PageHeader title="Users" />
      <form className="mb-5"><input name="q" defaultValue={q} placeholder="Search username or email" className="field max-w-sm" /></form>
      <div className="card divide-y divide-line">
        {rows.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                {u.username}
                {u.role === 'admin' && <span className="badge bg-ink text-paper">admin</span>}
                {u.banned_at && <span className="badge bg-signal-soft text-signal-dark">suspended</span>}
                {u.payout_hold ? <span className="badge bg-amber-soft text-amber">payouts held</span> : null}
                {!u.email_verified_at && <span className="badge bg-paper-3 text-ink-2">email unverified</span>}
              </p>
              <p className="text-sm text-ink-3">{u.email} · joined {dateShort(u.created_at)} · <Money n={u.balance} /> · <Money n={u.balance_usd} c="USD" /></p>
            </div>
            {u.id !== me.id && (
              <div className="flex flex-wrap items-center gap-3">
                <AdjustForm id={u.id} />
                {!u.email_verified_at && <VerifyEmailButton id={u.id} />}
                <HoldButton id={u.id} held={!!u.payout_hold} />
                <BanButton id={u.id} banned={!!u.banned_at} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

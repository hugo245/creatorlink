import { all } from '@/lib/db';
import { PageHeader, Robux } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { PaymentForm } from '../forms';

type Row = { id: string; kind: string; amount: number; status: string; gamepass_url: string | null; reference: string | null; admin_note: string | null; created_at: number; username: string; roblox_username: string | null };

export default async function AdminPayments() {
  const rows = await all<Row>(`SELECT p.*, u.username, u.roblox_username FROM payment_requests p JOIN users u ON u.id = p.user_id ORDER BY (p.status = 'pending') DESC, p.created_at DESC LIMIT 100`);
  return (
    <>
      <PageHeader title="Payments" sub="Deposits: confirm the gamepass purchase, then mark done to credit. Withdrawals: buy the gamepass, then mark done." />
      <div className="card divide-y divide-line">
        {rows.length === 0 && <p className="p-8 text-center text-ink-3">Nothing yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="font-semibold capitalize">{r.kind} · <Robux n={r.amount} /> <span className={`badge ml-2 ${r.status === 'pending' ? 'bg-amber-soft text-amber' : r.status === 'completed' ? 'bg-moss-soft text-moss' : 'bg-paper-3 text-ink-2'}`}>{r.status}</span></p>
              <p className="text-sm text-ink-3">{r.username}{r.roblox_username ? ` (Roblox: ${r.roblox_username})` : ''} · {dateTime(r.created_at)}</p>
              {r.kind === 'withdrawal' && r.gamepass_url && <a className="text-sm font-medium underline" target="_blank" rel="noopener noreferrer" href={`https://www.roblox.com/game-pass/${r.gamepass_url}`}>Gamepass {r.gamepass_url} ↗</a>}
              {r.reference && <p className="text-sm text-ink-2">Ref: {r.reference}</p>}
              {r.admin_note && <p className="text-xs text-ink-3">Note: {r.admin_note}</p>}
            </div>
            {r.status === 'pending' && <PaymentForm id={r.id} />}
          </div>
        ))}
      </div>
    </>
  );
}

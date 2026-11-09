import { ArrowDownLeft, ArrowUpRight, Lock } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { config } from '@/lib/config';
import { PageHeader, Robux } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { WalletForms } from './forms';
import type { PaymentRequest } from '@/lib/wallet';

export const metadata = { title: 'Wallet' };

type Tx = { id: string; kind: string; amount: number; balance_after: number; note: string | null; created_at: number; order_id: string | null };
const LABEL: Record<string, string> = {
  deposit: 'Deposit', test_deposit: 'Test funds', withdrawal: 'Withdrawal', withdrawal_refund: 'Withdrawal refunded',
  escrow_hold: 'Escrow hold', escrow_refund: 'Escrow refund', sale: 'Sale payout', adjustment: 'Adjustment',
};

export default async function WalletPage() {
  const user = await requireUser();
  const txs = await all<Tx>('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50', user.id);
  const pending = await all<PaymentRequest>("SELECT * FROM payment_requests WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC", user.id);
  const escrow = (await get<{ n: number }>("SELECT COALESCE(SUM(price),0) n FROM orders WHERE buyer_id = ? AND status IN ('pending','active','delivered','disputed')", user.id))!.n;

  return (
    <>
      <PageHeader title="Wallet" sub="Your Robux balance and a line-by-line ledger of every movement." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <p className="text-[13px] font-semibold text-ink-3">Available</p>
          <p className="mt-2 font-display text-5xl font-bold tracking-tight"><Robux n={user.balance} /></p>
        </div>
        <div className="card p-6">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-3"><Lock size={13} /> In escrow</p>
          <p className="mt-2 font-display text-5xl font-bold tracking-tight text-ink-3"><Robux n={escrow} /></p>
        </div>
      </div>

      <WalletForms testFunds={config.testFunds} gamepass={config.depositGamepassUrl} minDeposit={config.minDeposit} minWithdrawal={config.minWithdrawal} balance={user.balance} />

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Awaiting confirmation</h2>
          <ul className="card mt-3 divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
                <span><span className="font-semibold capitalize">{p.kind}</span> <span className="text-ink-3">· {dateTime(p.created_at)}</span></span>
                <span className="flex items-center gap-3"><span className="badge bg-amber-soft text-amber">Pending</span><Robux n={p.amount} className="font-semibold" /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">Ledger</h2>
        {txs.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-ink-3">No transactions yet.</p> : (
          <div className="card mt-4 overflow-hidden">
            <ul className="divide-y divide-line">
              {txs.map((t) => (
                <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.amount > 0 ? 'bg-moss-soft text-moss' : 'bg-paper-2 text-ink-2'}`}>
                    {t.amount > 0 ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{LABEL[t.kind] ?? t.kind}</p>
                    <p className="truncate text-xs text-ink-3">{t.note ?? ''}{t.note ? ' · ' : ''}{dateTime(t.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tnum ${t.amount > 0 ? 'text-moss' : ''}`}>{t.amount > 0 ? '+' : '−'}{Math.abs(t.amount).toLocaleString('en-US')}</p>
                    <p className="text-xs text-ink-4 tnum">{t.balance_after.toLocaleString('en-US')}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

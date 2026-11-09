import { ArrowDownLeft, ArrowUpRight, Lock } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { config, DAY } from '@/lib/config';
import { Money, PageHeader } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { fmtMoney, type Currency } from '@/lib/money';
import { listPending, withdrawableUsd } from '@/lib/wallet';
import { getConnectAccount, stripeConfigured } from '@/lib/stripe';
import { WalletForms } from './forms';

export const metadata = { title: 'Wallet' };

type Tx = { id: string; kind: string; amount: number; currency: Currency; balance_after: number; note: string | null; created_at: number };
const LABEL: Record<string, string> = {
  deposit: 'Deposit', test_deposit: 'Test funds', withdrawal: 'Withdrawal', withdrawal_refund: 'Withdrawal refunded',
  escrow_hold: 'Escrow hold', escrow_refund: 'Escrow refund', sale: 'Sale payout', adjustment: 'Adjustment',
};

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ deposit?: string; payouts?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const txs = await all<Tx>('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 60', user.id);
  const pending = await listPending(user.id);
  const escrow = await all<{ currency: Currency; n: number }>("SELECT currency, COALESCE(SUM(price),0) AS n FROM orders WHERE buyer_id = ? AND status IN ('pending','active','delivered','disputed') GROUP BY currency", user.id);
  const esc = (c: Currency) => escrow.find((e) => e.currency === c)?.n ?? 0;
  const { withdrawable, locked } = await withdrawableUsd(user.id, user.balance_usd);
  const cards = stripeConfigured();
  const payoutsEnabled = cards && user.stripe_account_id ? !!(await getConnectAccount(user.stripe_account_id).catch(() => null))?.payouts_enabled : false;
  const ageDays = (Date.now() - user.created_at) / DAY;
  let blocker: string | null = null;
  if (!user.email_verified_at) blocker = 'Verify your email to deposit or withdraw.';
  else if (user.payout_hold) blocker = 'Withdrawals are paused on your account while we review recent activity. Contact support.';
  else if (ageDays < config.minAccountAgeDaysForPayout) blocker = `New accounts can withdraw after ${config.minAccountAgeDaysForPayout} days.`;

  return (
    <>
      <PageHeader title="Wallet" sub="Two wallets, one ledger. Every movement is recorded line by line." />

      {sp.deposit === 'success' && <p role="status" className="mb-5 rounded-lg bg-moss-soft px-4 py-3 text-sm text-moss">Payment received. Your balance updates in a few seconds once the bank confirms it.</p>}
      {sp.deposit === 'cancelled' && <p role="status" className="mb-5 rounded-lg bg-paper-3 px-4 py-3 text-sm text-ink-2">Payment cancelled. You weren’t charged.</p>}
      {sp.payouts === 'return' && <p role="status" className="mb-5 rounded-lg bg-moss-soft px-4 py-3 text-sm text-moss">Thanks. Stripe is checking your details. Withdrawals unlock when they’re approved.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <p className="text-[13px] font-semibold text-ink-3">Robux</p>
          <p className="mt-2 font-display text-4xl font-bold tracking-tight"><Money n={user.balance} /></p>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-3"><Lock size={13} /> <Money n={esc('ROBUX')} /> in escrow</p>
        </div>
        <div className="card p-6">
          <p className="text-[13px] font-semibold text-ink-3">US dollars</p>
          <p className="mt-2 font-display text-4xl font-bold tracking-tight"><Money n={user.balance_usd} c="USD" /></p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
            <span className="flex items-center gap-1.5"><Lock size={13} /> <Money n={esc('USD')} c="USD" /> in escrow</span>
            {locked > 0 && <span title={`Earnings unlock ${config.usdPayoutHoldDays} days after each sale`}><Money n={locked} c="USD" /> unlocking</span>}
          </p>
        </div>
      </div>

      <WalletForms
        cards={cards}
        testFunds={config.testFunds}
        gamepass={config.depositGamepassUrl}
        feePercent={config.stripeFeePercent}
        feeFixedCents={config.stripeFeeFixedCents}
        holdDays={config.usdPayoutHoldDays}
        hasPayoutAccount={!!user.stripe_account_id}
        payoutsEnabled={payoutsEnabled}
        withdrawableUsd={withdrawable}
        robuxBalance={user.balance}
        blocker={blocker}
        emailVerified={!!user.email_verified_at}
      />

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Awaiting confirmation</h2>
          <ul className="card mt-3 divide-y divide-line">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
                <span><span className="font-semibold capitalize">{p.kind}</span> <span className="text-ink-3">· {dateTime(p.created_at)}</span></span>
                <span className="flex items-center gap-3"><span className="badge bg-amber-soft text-amber">Pending</span><Money n={p.amount} c={p.currency} className="font-semibold" /></span>
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
                    <p className="text-sm font-semibold">{LABEL[t.kind] ?? t.kind} <span className="ml-1 rounded bg-paper-3 px-1.5 py-0.5 text-[11px] font-semibold text-ink-3">{t.currency === 'USD' ? 'USD' : 'Robux'}</span></p>
                    <p className="truncate text-xs text-ink-3">{t.note ?? ''}{t.note ? ' · ' : ''}{dateTime(t.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tnum ${t.amount > 0 ? 'text-moss' : ''}`}>{t.amount > 0 ? '+' : '−'}{fmtMoney(Math.abs(t.amount), t.currency)}</p>
                    <p className="text-xs text-ink-4 tnum">{fmtMoney(t.balance_after, t.currency)}</p>
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

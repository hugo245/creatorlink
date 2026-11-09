import { all, get } from '@/lib/db';
import { PageHeader, Money } from '@/components/ui';
import type { Currency } from '@/lib/money';

export default async function AdminHome() {
  const s = (await get<Record<string, number>>(
    `SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM creators WHERE status = 'approved') AS creators,
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM orders WHERE status IN ('pending','active','delivered','disputed')) AS open_orders,
      COALESCE((SELECT SUM(balance) FROM users), 0) AS bal_robux,
      COALESCE((SELECT SUM(balance_usd) FROM users), 0) AS bal_usd`,
  ))!;
  const byCur = await all<{ currency: Currency; gmv: number; fees: number; escrow: number }>(
    `SELECT currency,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN price END), 0) AS gmv,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN fee END), 0) AS fees,
            COALESCE(SUM(CASE WHEN status IN ('pending','active','delivered','disputed') THEN price END), 0) AS escrow
       FROM orders GROUP BY currency`,
  );
  const cur = (c: Currency) => byCur.find((r) => r.currency === c) ?? { currency: c, gmv: 0, fees: 0, escrow: 0 };
  const rows: [string, Currency, number, number][] = [
    ['Completed volume', 'ROBUX', cur('ROBUX').gmv, cur('USD').gmv],
    ['Platform fees earned', 'ROBUX', cur('ROBUX').fees, cur('USD').fees],
    ['In escrow now', 'ROBUX', cur('ROBUX').escrow, cur('USD').escrow],
    ['User balances', 'ROBUX', s.bal_robux, s.bal_usd],
  ];
  return (
    <>
      <PageHeader title="Overview" sub="What you owe users = balances + escrow. Reconcile it against the Robux and the Stripe balance you actually hold." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Users', s.users], ['Approved creators', s.creators], ['Open orders', s.open_orders], ['All orders', s.orders]].map(([k, v]) => (
          <div key={k as string} className="card p-5"><p className="text-[13px] font-semibold text-ink-3">{k}</p><p className="mt-2 font-display text-2xl font-bold">{(v as number).toLocaleString()}</p></div>
        ))}
      </div>
      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-5 py-3">Money</th><th className="px-5 py-3">Robux</th><th className="px-5 py-3">USD</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map(([k, , r, u]) => (
              <tr key={k}><td className="px-5 py-3.5 font-medium">{k}</td><td className="px-5 py-3.5"><Money n={r} /></td><td className="px-5 py-3.5"><Money n={u} c="USD" /></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { get } from '@/lib/db';
import { PageHeader, Robux } from '@/components/ui';

export default function AdminHome() {
  const s = get<Record<string, number>>(
    `SELECT
      (SELECT COUNT(*) FROM users) users,
      (SELECT COUNT(*) FROM creators WHERE status = 'approved') creators,
      (SELECT COUNT(*) FROM orders) orders,
      (SELECT COUNT(*) FROM orders WHERE status IN ('pending','active','delivered','disputed')) open_orders,
      COALESCE((SELECT SUM(price) FROM orders WHERE status = 'completed'), 0) gmv,
      COALESCE((SELECT SUM(fee) FROM orders WHERE status = 'completed'), 0) fees,
      COALESCE((SELECT SUM(price) FROM orders WHERE status IN ('pending','active','delivered','disputed')), 0) escrow,
      COALESCE((SELECT SUM(balance) FROM users), 0) balances`,
  )!;
  const cards: [string, React.ReactNode][] = [
    ['Users', s.users.toLocaleString()], ['Approved creators', s.creators.toLocaleString()], ['Orders (open / all)', `${s.open_orders} / ${s.orders}`],
    ['Completed volume', <Robux key="g" n={s.gmv} />], ['Platform fees earned', <Robux key="f" n={s.fees} />],
    ['Currently in escrow', <Robux key="e" n={s.escrow} />], ['User balances (liability)', <Robux key="b" n={s.balances} />],
  ];
  return (
    <>
      <PageHeader title="Overview" sub="Liabilities = balances + escrow. Reconcile against the Robux you hold." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([k, v]) => (<div key={k} className="card p-5"><p className="text-[13px] font-semibold text-ink-3">{k}</p><p className="mt-2 font-display text-2xl font-bold">{v}</p></div>))}
      </div>
    </>
  );
}

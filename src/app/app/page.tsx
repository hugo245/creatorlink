import Link from 'next/link';
import { ArrowRight, PackageOpen } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { get } from '@/lib/db';
import { ordersForUser } from '@/lib/queries';
import { EmptyState, PageHeader, Robux } from '@/components/ui';
import { OrderList } from '@/components/app/order-list';

export default async function Overview() {
  const user = await requireUser();
  const open = await ordersForUser(user.id, 'open', 6);
  const stats = (await get<{ spent: number; earned: number; completed: number; escrow: number }>(
    `SELECT
       COALESCE((SELECT SUM(price) FROM orders WHERE buyer_id = ? AND status = 'completed'), 0) AS spent,
       COALESCE((SELECT SUM(price - fee) FROM orders WHERE seller_user_id = ? AND status = 'completed'), 0) AS earned,
       (SELECT COUNT(*) FROM orders WHERE (buyer_id = ? OR seller_user_id = ?) AND status = 'completed') AS completed,
       COALESCE((SELECT SUM(price) FROM orders WHERE buyer_id = ? AND status IN ('pending','active','delivered','disputed')), 0) AS escrow`,
    user.id, user.id, user.id, user.id, user.id,
  ))!;
  const action = open.filter((o) => (o.seller_user_id === user.id && o.status === 'pending') || (o.buyer_id === user.id && o.status === 'delivered'));

  return (
    <>
      <PageHeader title={`Hi, ${user.username}`} sub="Here’s what’s happening with your orders." actions={<Link href="/creators" className="btn btn-signal">Find a creator</Link>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          ['Available balance', <Robux key="a" n={user.balance} />, 'Spendable or withdrawable'],
          ['In escrow', <Robux key="b" n={stats.escrow} />, 'Held on your open orders'],
          ['Earned', <Robux key="c" n={stats.earned} />, 'After fees, all time'],
          ['Completed orders', stats.completed.toLocaleString(), 'Buying and selling'],
        ].map(([k, v, s], i) => (
          <div key={i} className="card p-4 sm:p-5">
            <p className="text-[13px] font-semibold text-ink-3">{k}</p>
            <p className="mt-2 font-display text-2xl font-bold sm:text-[28px] leading-none tracking-tight">{v}</p>
            <p className="mt-2 text-xs text-ink-3">{s}</p>
          </div>
        ))}
      </div>

      {action.length > 0 && (
        <section className="mt-8 rounded-2xl border border-signal/25 bg-signal-soft/60 p-5">
          <h2 className="font-display text-lg font-bold">Needs your attention ({action.length})</h2>
          <ul className="mt-3 space-y-2">
            {action.map((o) => (
              <li key={o.id}>
                <Link href={`/app/orders/${o.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium shadow-card transition hover:shadow-lift">
                  <span>{o.seller_user_id === user.id ? `Respond to ${o.buyer_name}’s request for “${o.game_name}”` : `Review ${o.creator_name}’s delivery for “${o.game_name}”`}</span>
                  <ArrowRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Open orders</h2>
          <Link href="/app/orders" className="text-sm font-semibold text-ink-2 hover:text-signal">View all</Link>
        </div>
        {open.length ? <OrderList orders={open} userId={user.id} /> : (
          <EmptyState icon={<PackageOpen size={22} />} title="No open orders" action={<Link href="/creators" className="btn btn-primary">Browse creators</Link>}>
            Orders you place or receive will show up here.
          </EmptyState>
        )}
      </section>

      {!user.creator_id && (
        <section className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-ink p-7 text-paper">
          <div><h2 className="font-display text-2xl font-bold">Have an audience? Get paid for it.</h2><p className="mt-1 text-paper/70">List your channel, set your prices, and receive pre-funded orders.</p></div>
          <Link href="/app/creator" className="btn btn-signal">Become a creator</Link>
        </section>
      )}
    </>
  );
}

import Link from 'next/link';
import clsx from 'clsx';
import { PackageOpen } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { ordersForUser } from '@/lib/queries';
import { EmptyState, PageHeader } from '@/components/ui';
import { OrderList } from '@/components/app/order-list';

export const metadata = { title: 'Orders' };

export default async function Orders({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const tab = (await searchParams).tab === 'done' ? 'done' : (await searchParams).tab === 'all' ? 'all' : 'open';
  const orders = await ordersForUser(user.id, tab);
  return (
    <>
      <PageHeader title="Orders" sub="Everything you’re buying and selling, with its conversation." />
      <div className="mb-5 inline-flex rounded-lg bg-paper-3 p-1 text-sm font-semibold" role="tablist">
        {([['open', 'Open'], ['done', 'Closed'], ['all', 'All']] as const).map(([k, l]) => (
          <Link key={k} href={`/app/orders?tab=${k}`} role="tab" aria-selected={tab === k} className={clsx('rounded-md px-4 py-1.5 transition', tab === k ? 'bg-white shadow-card' : 'text-ink-3 hover:text-ink')}>{l}</Link>
        ))}
      </div>
      {orders.length ? <OrderList orders={orders} userId={user.id} /> : (
        <EmptyState icon={<PackageOpen size={22} />} title={tab === 'open' ? 'No open orders' : 'Nothing here yet'} action={<Link href="/creators" className="btn btn-primary">Browse creators</Link>}>
          When you order a promotion, or a developer orders yours, it’ll appear here.
        </EmptyState>
      )}
    </>
  );
}

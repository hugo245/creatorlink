import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { Robux, StatusBadge } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import type { OrderRow } from '@/lib/queries';

export function OrderList({ orders, userId }: { orders: OrderRow[]; userId: string }) {
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {orders.map((o) => {
        const selling = o.seller_user_id === userId;
        const partner = selling ? o.buyer_name : o.creator_name;
        const needs = (selling && o.status === 'pending') || (!selling && o.status === 'delivered');
        return (
          <li key={o.id}>
            <Link href={`/app/orders/${o.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-paper">
              <Avatar name={partner} src={selling ? o.buyer_avatar : o.creator_avatar} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate font-semibold">{o.game_name}</p>
                  <StatusBadge status={o.status} />
                  {needs && <span className="badge bg-signal text-white">Your move</span>}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-3">
                  {selling ? 'Sold to' : 'Bought from'} {partner} · {o.package_title} · {timeAgo(o.updated_at)}
                </p>
                {o.last_message && <p className="mt-1 hidden truncate text-[13px] text-ink-4 sm:block">“{o.last_message}”</p>}
              </div>
              <div className="text-right">
                <Robux n={selling ? o.price - o.fee : o.price} className="font-display text-lg font-bold" />
                <p className="text-xs text-ink-3">{selling ? 'you earn' : 'escrow'}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

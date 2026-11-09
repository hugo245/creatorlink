import Link from 'next/link';
import { all } from '@/lib/db';
import { PageHeader, Money } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { DisputeForm } from '../forms';

export default async function AdminDisputes() {
  const rows = await all<{ id: string; game_name: string; package_title: string; price: number; currency: 'ROBUX' | 'USD'; dispute_reason: string; buyer: string; creator: string; opener: string; updated_at: number }>(
    `SELECT o.id, o.game_name, o.package_title, o.price, o.currency, o.dispute_reason, o.updated_at, b.username buyer, c.display_name creator,
            (SELECT username FROM users WHERE id = o.dispute_by) opener
       FROM orders o JOIN users b ON b.id = o.buyer_id JOIN creators c ON c.id = o.creator_id
      WHERE o.status = 'disputed' ORDER BY o.updated_at`,
  );
  return (
    <>
      <PageHeader title="Disputes" sub="Read the conversation first. Your note is posted to the order." />
      {rows.length === 0 ? <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-ink-3">No open disputes.</p> : (
        <ul className="space-y-4">
          {rows.map((d) => (
            <li key={d.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">{d.game_name} <span className="font-normal text-ink-3">· {d.package_title}</span></p>
                  <p className="text-sm text-ink-3">Buyer {d.buyer} · Creator {d.creator} · opened by {d.opener} · {dateTime(d.updated_at)}</p>
                </div>
                <Money n={d.price} c={d.currency} className="font-display text-xl font-bold" />
              </div>
              <blockquote className="mt-3 rounded-lg bg-paper-2 px-4 py-3 text-sm text-ink-2">{d.dispute_reason}</blockquote>
              <div className="mt-3"><Link href={`/app/orders/${d.id}`} className="text-sm font-semibold underline">Read conversation & delivery →</Link></div>
              <div className="mt-4 border-t border-line pt-4"><DisputeForm id={d.id} /></div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

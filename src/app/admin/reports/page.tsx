import Link from 'next/link';
import { all } from '@/lib/db';
import { PageHeader } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { ReportForm } from '../forms';

type Row = { id: string; target_type: string; target_id: string; reason: string; details: string; status: string; created_at: number; reporter: string; target_label: string | null; target_href: string | null };

export default async function AdminReports() {
  const reports = await all<Row>(
    `SELECT r.*, u.username AS reporter,
            CASE r.target_type WHEN 'creator' THEN (SELECT display_name FROM creators WHERE id = r.target_id)
                               WHEN 'order' THEN (SELECT game_name FROM orders WHERE id = r.target_id)
                               ELSE (SELECT username FROM users WHERE id = r.target_id) END AS target_label,
            CASE r.target_type WHEN 'creator' THEN (SELECT '/creators/' || slug FROM creators WHERE id = r.target_id)
                               WHEN 'order' THEN '/app/orders/' || r.target_id ELSE NULL END AS target_href
       FROM reports r JOIN users u ON u.id = r.reporter_id
      ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 100`,
  );
  const flagged = await all<{ id: string; order_id: string; body: string; sender: string | null; created_at: number }>(
    `SELECT m.id, m.order_id, m.body, u.username AS sender, m.created_at FROM messages m LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.flagged = 1 ORDER BY m.created_at DESC LIMIT 25`,
  );
  return (
    <>
      <PageHeader title="Reports" sub="User reports and chat messages flagged for off-platform payment or credential requests." />
      <ul className="space-y-4">
        {reports.length === 0 && <li className="rounded-xl border border-dashed border-line-strong p-10 text-center text-ink-3">No reports.</li>}
        {reports.map((r) => (
          <li key={r.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold capitalize">{r.reason.replace('_', ' ')} · {r.target_type}{' '}
                  {r.target_href ? <Link className="underline" href={r.target_href}>{r.target_label ?? r.target_id}</Link> : <span>{r.target_label ?? r.target_id}</span>}
                </p>
                <p className="text-sm text-ink-3">Reported by {r.reporter} · {dateTime(r.created_at)} · <span className="font-medium">{r.status}</span></p>
                {r.details && <p className="mt-2 text-sm text-ink-2">{r.details}</p>}
              </div>
              {r.status === 'open' && <ReportForm id={r.id} />}
            </div>
          </li>
        ))}
      </ul>
      <h2 className="mb-3 mt-10 font-display text-xl font-bold">Flagged messages</h2>
      <div className="card divide-y divide-line">
        {flagged.length === 0 && <p className="p-6 text-center text-sm text-ink-3">Nothing flagged.</p>}
        {flagged.map((m) => (
          <div key={m.id} className="px-5 py-3.5 text-sm">
            <p className="text-ink-3">{m.sender ?? 'system'} · {dateTime(m.created_at)} · <Link className="font-medium underline" href={`/app/orders/${m.order_id}`}>open order</Link></p>
            <p className="mt-1 text-ink-2">{m.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}

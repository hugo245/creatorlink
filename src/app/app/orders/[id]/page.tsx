import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ExternalLink, Gamepad2, Info, Star } from 'lucide-react';
import clsx from 'clsx';
import { requireUser } from '@/lib/auth';
import { get } from '@/lib/db';
import { orderDetail, orderMessages } from '@/lib/queries';
import { Robux, StatusBadge } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { dateTime, plural, relativeDue } from '@/lib/format';
import { Chat } from './chat';
import { OrderActions } from './order-actions';

export const metadata = { title: 'Order' };

const STEPS = ['Funded', 'Accepted', 'Delivered', 'Released'] as const;

function stepIndex(status: string, delivered: boolean) {
  switch (status) {
    case 'pending': return 0;
    case 'active': return delivered ? 2 : 1; // revision in progress keeps step 1
    case 'delivered': return 2;
    case 'completed': return 4;
    default: return -1;
  }
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const o = orderDetail(id);
  if (!o) notFound();
  const role = o.buyer_id === user.id ? 'buyer' : o.seller_user_id === user.id ? 'seller' : user.role === 'admin' ? 'admin' : null;
  if (!role) notFound();

  const placed = (await searchParams).placed === '1';
  const msgs = orderMessages(o.id);
  const review = get<{ rating: number; body: string }>('SELECT rating, body FROM reviews WHERE order_id = ?', o.id);
  const closed = ['completed', 'cancelled', 'declined', 'refunded'].includes(o.status);
  const canChat = !closed || Date.now() - (o.completed_at ?? o.updated_at) < 7 * 86_400_000;
  const partner = role === 'seller' ? o.buyer_name : o.creator_name;
  const idx = stepIndex(o.status, false);
  const due = o.status === 'active' && o.due_at ? relativeDue(o.due_at) : null;

  let hint: string | null = null;
  if (o.status === 'pending' && o.respond_by) hint = `${role === 'seller' ? 'Respond' : 'Creator must respond'} ${relativeDue(o.respond_by).text} or the order is refunded.`;
  if (o.status === 'delivered' && o.auto_release_at) hint = `${role === 'buyer' ? 'Review within' : 'Auto-release'} ${relativeDue(o.auto_release_at).text.replace('in ', '')}${role === 'buyer' ? ' or funds release automatically.' : ' if the buyer doesn’t respond.'}`;

  return (
    <>
      <Link href="/app/orders" className="text-sm font-medium text-ink-3 hover:text-ink">← Orders</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight">{o.game_name}</h1>
            <StatusBadge status={o.status} />
          </div>
          <p className="mt-1.5 text-ink-3">{o.package_title} · {role === 'seller' ? 'Buyer' : 'Creator'}: <span className="font-medium text-ink">{partner}</span></p>
        </div>
        <div className="text-right">
          <Robux n={role === 'seller' ? o.price - o.fee : o.price} className="font-display text-3xl font-bold" />
          <p className="text-xs text-ink-3">{role === 'seller' ? `you earn · after R$ ${o.fee.toLocaleString('en-US')} fee` : closed ? 'order total' : 'held in escrow'}</p>
        </div>
      </div>

      {placed && (
        <p className="mt-6 flex items-start gap-2.5 rounded-xl bg-moss-soft px-4 py-3 text-sm text-moss" role="status">
          <Check size={17} className="mt-0.5 shrink-0" strokeWidth={3} />
          Order placed and funds are held in escrow. {partner} has {plural(48, 'hour')} to accept. Say hello in the conversation.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-6">
          {/* progress */}
          <section className="card p-6" aria-label="Progress">
            {idx >= 0 ? (
              <ol className="grid grid-cols-4 gap-2">
                {STEPS.map((s, i) => {
                  const done = i < idx;
                  const now = i === idx;
                  return (
                    <li key={s} className="min-w-0">
                      <div className={clsx('h-1.5 rounded-full', done ? 'bg-ink' : now ? 'bg-signal' : 'bg-paper-3')} />
                      <p className={clsx('mt-2 flex items-center gap-1 text-[13px] font-semibold', done || now ? 'text-ink' : 'text-ink-4')}>
                        {done && <Check size={13} strokeWidth={3} className="text-moss" />}{s}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm font-medium text-ink-2">{o.status === 'disputed' ? 'This order is in dispute. Funds stay locked until support decides.' : o.closed_reason ?? 'This order is closed.'}</p>
            )}
            {(due || hint) && (
              <p className={clsx('mt-4 flex items-center gap-2 text-sm', due?.overdue ? 'font-semibold text-signal-dark' : 'text-ink-3')}>
                <Info size={15} className="shrink-0" />
                {due ? `Delivery due ${dateTime(o.due_at!)} · ${due.text}` : hint}
              </p>
            )}
            {o.revisions_used > 0 && <p className="mt-2 text-xs text-ink-3">Revisions used: {o.revisions_used} of {o.revisions_allowed}</p>}
          </section>

          {/* actions */}
          {(role !== 'admin' && !closed) || (role === 'buyer' && o.status === 'completed' && !review) ? (
            <section className="card p-6" aria-label="Actions">
              <OrderActions
                id={o.id} role={role} status={o.status} price={o.price}
                late={!!o.due_at && o.due_at < Date.now()} revisionsLeft={o.revisions_allowed - o.revisions_used} reviewed={!!review}
              />
            </section>
          ) : null}

          {o.status === 'disputed' && (
            <section className="rounded-2xl border border-signal/25 bg-signal-soft/60 p-6">
              <h2 className="font-display text-lg font-bold">Dispute</h2>
              <p className="mt-2 text-sm text-ink-2">{o.dispute_reason}</p>
              {role === 'admin' && <Link href="/admin/disputes" className="btn btn-primary btn-sm mt-4">Resolve in admin</Link>}
            </section>
          )}

          {o.delivery_url && (
            <section className="card p-6">
              <h2 className="font-display text-lg font-bold">Delivery</h2>
              <a href={o.delivery_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm font-semibold transition hover:border-ink">
                <span className="truncate">{o.delivery_url}</span><ExternalLink size={16} className="shrink-0" />
              </a>
              {o.delivery_note && <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{o.delivery_note}</p>}
              {o.delivered_at && <p className="mt-2 text-xs text-ink-3">Delivered {dateTime(o.delivered_at)}</p>}
            </section>
          )}

          {review && (
            <section className="card p-6">
              <h2 className="font-display text-lg font-bold">Review</h2>
              <div className="mt-2 flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} className={n <= review.rating ? 'fill-amber text-amber' : 'text-line-strong'} />)}</div>
              {review.body && <p className="mt-2 text-sm text-ink-2">{review.body}</p>}
            </section>
          )}

          <section className="card p-6">
            <h2 className="font-display text-lg font-bold">Brief</h2>
            <a href={o.game_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"><Gamepad2 size={16} /> Open game on Roblox</a>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-2">{o.brief}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
              <div><dt className="text-ink-3">Placed</dt><dd className="font-medium">{dateTime(o.created_at)}</dd></div>
              <div><dt className="text-ink-3">Turnaround</dt><dd className="font-medium">{plural(o.delivery_days, 'day')}</dd></div>
              <div><dt className="text-ink-3">Revisions</dt><dd className="font-medium">{o.revisions_allowed}</dd></div>
              <div className="col-span-2 flex items-center gap-2 sm:col-span-3">
                <Avatar name={partner} src={role === 'seller' ? o.buyer_avatar : o.creator_avatar} size={24} />
                {role === 'buyer' || role === 'admin' ? <Link href={`/creators/${o.creator_slug}`} className="font-medium underline underline-offset-4">View {o.creator_name}’s profile</Link> : <span className="text-ink-3">Buyer: {o.buyer_name}</span>}
              </div>
            </dl>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Chat orderId={o.id} userId={user.id} initial={msgs} canSend={canChat} />
        </div>
      </div>
    </>
  );
}

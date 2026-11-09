import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Clock, Lock, RotateCcw } from 'lucide-react';
import { Shell } from '@/components/marketing/shell';
import { Avatar } from '@/components/avatar';
import { Robux } from '@/components/ui';
import { getUser } from '@/lib/auth';
import { getCreatorBySlug, getPackage } from '@/lib/creators';
import { OrderForm } from './order-form';
import { feeFor } from '@/lib/orders';
import { config } from '@/lib/config';
import { plural } from '@/lib/format';

export const metadata: Metadata = { title: 'Place order', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ slug: string; packageId: string }> }) {
  const { slug, packageId } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/creators/${slug}/order/${packageId}`)}`);
  const c = getCreatorBySlug(slug);
  const p = getPackage(packageId);
  if (!c || c.status !== 'approved' || !p || p.creator_id !== c.id || !p.active) notFound();
  if (c.user_id === user.id) redirect(`/creators/${slug}`);
  const short = user.balance < p.price;

  return (
    <Shell>
      <div className="container-x py-10 lg:py-14">
        <Link href={`/creators/${slug}`} className="text-sm font-medium text-ink-3 hover:text-ink">← Back to {c.display_name}</Link>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Place your order</h1>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_390px]">
          <div className="card p-6 sm:p-8">
            <OrderForm packageId={p.id} disabled={short} />
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <Avatar name={c.display_name} src={c.avatar} size={44} />
                <div><p className="font-display font-bold leading-tight">{c.display_name}</p><p className="text-sm text-ink-3">{p.title}</p></div>
              </div>
              <p className="mt-4 flex gap-4 text-xs font-medium text-ink-2">
                <span className="flex items-center gap-1"><Clock size={13} />{plural(p.delivery_days, 'day')}</span>
                <span className="flex items-center gap-1"><RotateCcw size={13} />{plural(p.revisions, 'revision')}</span>
              </p>
              <dl className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-3">Package</dt><dd className="font-semibold"><Robux n={p.price} /></dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Service fee (paid by creator)</dt><dd className="text-ink-3"><Robux n={feeFor(p.price)} /></dd></div>
                <div className="flex justify-between border-t border-line pt-3 font-display text-lg font-bold"><dt>You pay</dt><dd><Robux n={p.price} /></dd></div>
              </dl>
            </div>
            <div className={`rounded-2xl border p-5 text-sm ${short ? 'border-signal/30 bg-signal-soft' : 'border-line bg-white'}`}>
              <div className="flex items-center justify-between"><span className="text-ink-3">Your balance</span><Robux n={user.balance} className="font-semibold" /></div>
              {short && (
                <p className="mt-3 text-signal-dark">You need <Robux n={p.price - user.balance} className="font-semibold" /> more. <Link href="/app/wallet" className="font-semibold underline">Add funds</Link></p>
              )}
            </div>
            <p className="flex gap-2.5 px-1 text-xs leading-relaxed text-ink-3"><Lock size={14} className="mt-0.5 shrink-0 text-moss" />Your Robux is held in escrow. If {c.display_name} doesn’t accept within {config.acceptWindowHours} hours, it’s refunded automatically.</p>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

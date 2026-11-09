import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowUpRight, Clock, RotateCcw, ShieldCheck } from 'lucide-react';
import { Shell } from '@/components/marketing/shell';
import { Avatar } from '@/components/avatar';
import { PlatformIcons, Robux, Stars } from '@/components/ui';
import { getCreatorBySlug, getPackages, getReviews } from '@/lib/creators';
import { getUser } from '@/lib/auth';
import { compact, plural, rating, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCreatorBySlug((await params).slug);
  if (!c || c.status !== 'approved') return { title: 'Creator not found' };
  return { title: c.display_name, description: c.headline, openGraph: { title: `${c.display_name} on CreatorLink`, description: c.headline } };
}

export default async function CreatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getUser();
  const c = await getCreatorBySlug(slug);
  const own = !!user && !!c && c.user_id === user.id;
  if (!c || (c.status !== 'approved' && !own && user?.role !== 'admin')) notFound();
  const pkgs = await getPackages(c.id);
  const reviews = await getReviews(c.id);
  const avg = rating(c.rating_sum, c.rating_count);

  return (
    <Shell>
      {c.status !== 'approved' && (
        <div className="bg-amber-soft px-5 py-2.5 text-center text-sm font-medium text-amber">This profile is {c.status} and isn’t visible to the public.</div>
      )}
      <div className="container-x grid gap-10 py-10 lg:grid-cols-[1fr_380px] lg:py-14">
        <div className="min-w-0">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar name={c.display_name} src={c.avatar} size={96} />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl font-bold tracking-tight">{c.display_name}</h1>
                <PlatformIcons platform={c.platform} size={20} />
              </div>
              <p className="mt-2 max-w-xl text-lg text-ink-2">{c.headline}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.niches.map((n) => <span key={n} className="rounded-md bg-paper-3 px-2.5 py-1 text-xs font-semibold text-ink-2">{n}</span>)}
              </div>
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {[
              ['Audience', compact(c.followers)], ['Avg. views', compact(c.avg_views)],
              ['Completed', c.completed_orders.toString()], ['Rating', c.rating_count ? avg.toFixed(1) + ' / 5' : 'New'],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-5 py-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-3">{k}</dt>
                <dd className="mt-1 font-display text-2xl font-bold tnum">{v}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold">About</h2>
            <p className="mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-ink-2">{c.bio}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {c.youtube_url && <a href={c.youtube_url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-outline btn-sm">YouTube channel <ArrowUpRight size={14} /></a>}
              {c.tiktok_url && <a href={c.tiktok_url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-outline btn-sm">TikTok profile <ArrowUpRight size={14} /></a>}
            </div>
          </section>

          <section className="mt-12">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-2xl font-bold">Reviews</h2>
              {c.rating_count > 0 && <Stars value={avg} count={c.rating_count} size={16} />}
            </div>
            {reviews.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-line-strong p-6 text-sm text-ink-3">No reviews yet. Reviews can only be left by developers who completed an order.</p>
            ) : (
              <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-white">
                {reviews.map((r) => (
                  <li key={r.id} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.buyer} size={32} />
                        <div>
                          <p className="text-sm font-semibold leading-tight">{r.buyer}</p>
                          <p className="text-xs text-ink-3">{r.game_name} · {timeAgo(r.created_at)}</p>
                        </div>
                      </div>
                      <Stars value={r.rating} size={13} />
                    </div>
                    {r.body && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{r.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Packages">
          <div className="rounded-2xl border border-line bg-white p-2 shadow-lift">
            <h2 className="px-4 pb-1 pt-3 font-display text-lg font-bold">Packages</h2>
            {pkgs.length === 0 && <p className="px-4 pb-4 text-sm text-ink-3">No packages available.</p>}
            <ul className="space-y-2 p-2">
              {pkgs.map((p) => (
                <li key={p.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug">{p.title}</h3>
                    <Robux n={p.price} className="font-display text-lg font-bold" />
                  </div>
                  {p.description && <p className="mt-1.5 text-sm leading-snug text-ink-3">{p.description}</p>}
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-ink-2">
                    <span className="flex items-center gap-1"><Clock size={13} /> {plural(p.delivery_days, 'day')}</span>
                    <span className="flex items-center gap-1"><RotateCcw size={13} /> {plural(p.revisions, 'revision')}</span>
                  </p>
                  {own ? (
                    <Link href="/app/creator" className="btn btn-outline btn-sm mt-4 w-full">Edit in dashboard</Link>
                  ) : c.status === 'approved' ? (
                    <Link href={`/creators/${c.slug}/order/${p.id}`} className="btn btn-signal mt-4 w-full">Order this package</Link>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-2 px-4 pb-4 pt-1 text-xs text-ink-3"><ShieldCheck size={14} className="shrink-0 text-moss" /> Held in escrow until you approve the delivery.</p>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

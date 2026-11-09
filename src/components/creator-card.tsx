import Link from 'next/link';
import { Avatar } from './avatar';
import { PlatformIcons, Robux, Stars } from './ui';
import { compact, rating } from '@/lib/format';
import type { Creator } from '@/lib/creators';

export function CreatorCard({ c }: { c: Creator }) {
  return (
    <Link
      href={`/creators/${c.slug}`}
      className="group flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={c.display_name} src={c.avatar} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-[17px] font-bold leading-tight">{c.display_name}</h3>
            <PlatformIcons platform={c.platform} />
          </div>
          <div className="mt-1"><Stars value={rating(c.rating_sum, c.rating_count)} count={c.rating_count} /></div>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 h-[2.45rem] text-sm leading-snug text-ink-2">{c.headline}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.niches.slice(0, 3).map((n) => (
          <span key={n} className="rounded-md bg-paper-2 px-2 py-0.5 text-xs font-medium text-ink-2">{n}</span>
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Audience</dt>
          <dd className="font-semibold tnum">{compact(c.followers)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Avg views</dt>
          <dd className="font-semibold tnum">{compact(c.avg_views)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-3">From</dt>
          <dd className="font-semibold">{c.min_price ? <Robux n={c.min_price} /> : '—'}</dd>
        </div>
      </dl>
    </Link>
  );
}

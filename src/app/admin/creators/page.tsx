import Link from 'next/link';
import { all } from '@/lib/db';
import { PageHeader, PlatformIcons } from '@/components/ui';
import { compact, dateShort } from '@/lib/format';
import { CreatorReviewForm } from '../forms';

type Row = { id: string; slug: string; display_name: string; username: string; platform: 'youtube' | 'tiktok' | 'both'; youtube_url: string | null; tiktok_url: string | null; followers: number; avg_views: number; headline: string; bio: string; niches: string; status: string; review_note: string | null; created_at: number };

export default async function AdminCreators() {
  const rows = await all<Row>(`SELECT c.*, u.username FROM creators c JOIN users u ON u.id = c.user_id ORDER BY CASE c.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, c.created_at DESC`);
  return (
    <>
      <PageHeader title="Creators" sub="Review applications. Open the channel links and check the audience numbers before approving." />
      <ul className="space-y-4">
        {rows.length === 0 && <li className="text-ink-3">No creators yet.</li>}
        {rows.map((c) => (
          <li key={c.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link href={`/creators/${c.slug}`} className="font-display text-lg font-bold hover:underline">{c.display_name}</Link>
                  <PlatformIcons platform={c.platform} />
                  <span className={`badge ${c.status === 'approved' ? 'bg-moss-soft text-moss' : c.status === 'pending' ? 'bg-amber-soft text-amber' : 'bg-signal-soft text-signal-dark'}`}>{c.status}</span>
                </div>
                <p className="mt-1 text-sm text-ink-3">@{c.username} · applied {dateShort(c.created_at)} · {compact(c.followers)} followers · {compact(c.avg_views)} avg views</p>
                <p className="mt-2 text-sm font-medium">{c.headline}</p>
                <p className="mt-1 line-clamp-3 text-sm text-ink-2">{c.bio}</p>
                <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                  {c.youtube_url && <a className="font-medium underline" href={c.youtube_url} target="_blank" rel="noopener noreferrer nofollow">YouTube ↗</a>}
                  {c.tiktok_url && <a className="font-medium underline" href={c.tiktok_url} target="_blank" rel="noopener noreferrer nofollow">TikTok ↗</a>}
                </p>
                {c.review_note && <p className="mt-2 text-xs text-ink-3">Note: {c.review_note}</p>}
              </div>
              <div className="w-full sm:w-[420px]"><CreatorReviewForm id={c.id} status={c.status} /></div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

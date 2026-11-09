import Link from 'next/link';
import { BadgeCheck, TriangleAlert } from 'lucide-react';
import { all } from '@/lib/db';
import { PageHeader, PlatformIcons } from '@/components/ui';
import { compact, dateShort, timeAgo } from '@/lib/format';
import { CreatorReviewForm, VerifyPlatformButton } from '../forms';

type Row = {
  id: string; slug: string; display_name: string; username: string; platform: 'youtube' | 'tiktok' | 'both'; followers: number; avg_views: number;
  headline: string; bio: string; status: string; review_note: string | null; review_flags: string | null; created_at: number; verification_code: string | null;
  youtube_url: string | null; youtube_channel_id: string | null; youtube_verified_at: number | null; youtube_subs: number | null; youtube_avg_views: number | null; youtube_synced_at: number | null;
  tiktok_url: string | null; tiktok_handle: string | null; tiktok_verified_at: number | null; tiktok_followers: number | null;
  email_verified_at: number | null; user_created_at: number;
};

export default async function AdminCreators() {
  const rows = await all<Row>(
    `SELECT c.*, u.username, u.email_verified_at, u.created_at AS user_created_at FROM creators c JOIN users u ON u.id = c.user_id
      ORDER BY CASE c.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, c.created_at DESC`,
  );
  return (
    <>
      <PageHeader title="Creators" sub="Approve only channels whose ownership is verified. Check the flags, then open the channel and compare the name and numbers." />
      <ul className="space-y-4">
        {rows.length === 0 && <li className="text-ink-3">No creators yet.</li>}
        {rows.map((c) => {
          const flags: string[] = JSON.parse(c.review_flags ?? '[]');
          const verified = !!(c.youtube_verified_at || c.tiktok_verified_at);
          return (
            <li key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link href={`/creators/${c.slug}`} className="font-display text-lg font-bold hover:underline">{c.display_name}</Link>
                    <PlatformIcons platform={c.platform} />
                    <span className={`badge ${c.status === 'approved' ? 'bg-moss-soft text-moss' : c.status === 'pending' ? 'bg-amber-soft text-amber' : 'bg-signal-soft text-signal-dark'}`}>{c.status}</span>
                    {verified ? <span className="badge bg-sky-soft text-sky"><BadgeCheck size={12} /> ownership verified</span> : <span className="badge bg-paper-3 text-ink-2">not verified</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink-3">@{c.username} · account {dateShort(c.user_created_at)} · email {c.email_verified_at ? 'verified' : 'NOT verified'} · {compact(c.followers)} audience · {compact(c.avg_views)} avg views</p>
                  {flags.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {flags.map((f) => <li key={f} className="flex items-start gap-2 rounded-md bg-amber-soft px-2.5 py-1.5 text-sm text-amber"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{f}</li>)}
                    </ul>
                  )}
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {c.youtube_url && (
                      <div className="rounded-lg bg-paper-2 p-3">
                        <dt className="font-semibold">YouTube {c.youtube_verified_at ? '✓ verified' : '(unverified)'}</dt>
                        <dd className="text-ink-3"><a className="underline" target="_blank" rel="noopener noreferrer nofollow" href={c.youtube_url}>open channel</a>
                          {c.youtube_subs !== null && <> · {compact(c.youtube_subs)} subs · {compact(c.youtube_avg_views ?? 0)} avg views{c.youtube_synced_at ? ` · synced ${timeAgo(c.youtube_synced_at)}` : ''}</>}</dd>
                        {!c.youtube_verified_at && <div className="mt-2"><VerifyPlatformButton id={c.id} platform="youtube" /></div>}
                      </div>
                    )}
                    {c.tiktok_url && (
                      <div className="rounded-lg bg-paper-2 p-3">
                        <dt className="font-semibold">TikTok {c.tiktok_verified_at ? '✓ verified' : '(unverified)'}</dt>
                        <dd className="text-ink-3"><a className="underline" target="_blank" rel="noopener noreferrer nofollow" href={c.tiktok_url}>open profile</a>
                          {c.tiktok_followers !== null && <> · {compact(c.tiktok_followers)} followers</>}</dd>
                        {!c.tiktok_verified_at && <div className="mt-2"><VerifyPlatformButton id={c.id} platform="tiktok" /></div>}
                      </div>
                    )}
                  </dl>
                  {!verified && c.verification_code && <p className="mt-2 text-sm text-ink-3">Look for this code in their channel description / bio: <code className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-ink">{c.verification_code}</code></p>}
                  <p className="mt-3 text-sm font-medium">{c.headline || <span className="text-ink-4">No headline yet</span>}</p>
                  <p className="mt-1 line-clamp-3 text-sm text-ink-2">{c.bio}</p>
                  {c.review_note && <p className="mt-2 text-xs text-ink-3">Note: {c.review_note}</p>}
                </div>
                <div className="w-full sm:w-[420px]"><CreatorReviewForm id={c.id} status={c.status} /></div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

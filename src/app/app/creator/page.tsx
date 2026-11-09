import Link from 'next/link';
import { CheckCircle2, Clock, XCircle, Ban } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getCreatorByUser, getPackages } from '@/lib/creators';
import { PageHeader } from '@/components/ui';
import { assertEmailVerified } from '@/lib/identity';
import { config } from '@/lib/config';
import { ChannelLinker, DetailsEditor, ListedToggle, PackagesEditor } from './editors';

export const metadata = { title: 'Creator profile' };

export default async function CreatorPage() {
  const user = await requireUser();
  const c = await getCreatorByUser(user.id);
  const pkgs = c ? await getPackages(c.id) : [];
  const emailOk = (() => { try { assertEmailVerified(user); return true; } catch { return false; } })();
  const verified = !!c?.verified;
  const lookupEnabled = !!process.env.YOUTUBE_API_KEY;

  const banner = !c ? null : {
    pending: verified
      ? { Icon: Clock, cls: 'bg-amber-soft text-amber', t: 'Ownership verified. Waiting for review', d: 'Our team reviews every creator, usually within a day. You can add your details and packages meanwhile.' }
      : { Icon: Clock, cls: 'bg-amber-soft text-amber', t: 'Verify your channel to continue', d: 'Prove the channel is yours with the code below. Only verified creators can be approved.' },
    approved: { Icon: CheckCircle2, cls: 'bg-moss-soft text-moss', t: c.is_listed ? 'You’re live in the marketplace' : 'Your listing is paused', d: pkgs.length ? (c.is_listed ? 'Developers can find and order from you.' : 'Hidden from browse. Existing orders continue as normal.') : 'Add at least one package so developers can order from you.' },
    rejected: { Icon: XCircle, cls: 'bg-signal-soft text-signal-dark', t: 'Application not approved', d: c.review_note ?? 'Update your profile and save to re-apply.' },
    suspended: { Icon: Ban, cls: 'bg-signal-soft text-signal-dark', t: 'Account suspended', d: c.review_note ?? 'Contact support for details.' },
  }[c.status];

  return (
    <>
      <PageHeader
        title={c ? 'Creator profile' : 'Become a creator'}
        sub={c ? 'Your public profile, verified channels and packages.' : 'Link your channel and prove it’s yours. Your name and numbers are read straight from the platform.'}
        actions={c?.status === 'approved' ? <div className="flex gap-2"><Link href={`/creators/${c.slug}`} className="btn btn-outline">View public page</Link><ListedToggle listed={!!c.is_listed} /></div> : undefined}
      />

      {!emailOk && <p className="mb-6 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">Verify your email address first. Creator accounts need a confirmed email.</p>}
      {banner && (
        <div className={`mb-6 flex gap-3 rounded-2xl px-5 py-4 ${banner.cls}`}>
          <banner.Icon size={20} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">{banner.t}</p><p className="mt-0.5 text-sm opacity-90">{banner.d}</p></div>
        </div>
      )}
      {c && c.review_flags.length > 0 && c.status === 'pending' && (
        <p className="mb-6 rounded-xl bg-paper-3 px-4 py-3 text-sm text-ink-2">Our team will take a closer look at this application: {c.review_flags.join('; ')}.</p>
      )}

      {c?.status === 'suspended' ? null : (
        <div className="space-y-8">
          <section className="card p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold">1. Your channels</h2>
            <p className="mt-1 text-sm text-ink-3">We read your public name and numbers from the platform, and confirm ownership with a one-time code that only you can add to your channel.</p>
            <ChannelLinker
              disabled={!emailOk}
              lookupEnabled={lookupEnabled}
              code={c?.verification_code ?? null}
              youtube={c?.youtube_url ? { url: c.youtube_url, title: c.youtube_title, thumb: c.youtube_thumb, subs: c.youtube_subs, avgViews: c.youtube_avg_views, videos: c.youtube_video_count, verified: !!c.youtube_verified_at, syncedAt: c.youtube_synced_at } : null}
              tiktok={c?.tiktok_url ? { url: c.tiktok_url, title: c.tiktok_title, followers: c.tiktok_followers, likes: c.tiktok_likes, verified: !!c.tiktok_verified_at, syncedAt: c.tiktok_synced_at } : null}
            />
          </section>

          {c && (
            <section className="card p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold">2. About you</h2>
              <DetailsEditor name={c.display_name} headline={c.headline} bio={c.bio} niches={c.niches} />
            </section>
          )}

          {c && (
            <section className="card p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold">3. Packages</h2>
              <p className="mt-1 text-sm text-ink-3">Fixed-price offers in Robux or US dollars. You receive the price minus the platform fee ({config.feeBps / 100}%).</p>
              <PackagesEditor feeBps={config.feeBps} packages={pkgs.map((p) => ({ id: p.id, title: p.title, description: p.description, price: p.price, currency: p.currency, deliveryDays: p.delivery_days, revisions: p.revisions }))} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

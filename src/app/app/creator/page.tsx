import Link from 'next/link';
import { Clock, XCircle, CheckCircle2, Ban } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getCreatorByUser, getPackages } from '@/lib/creators';
import { config } from '@/lib/config';
import { PageHeader } from '@/components/ui';
import { ProfileEditor, PackagesEditor, ListedToggle } from './editors';

export const metadata = { title: 'Creator listing' };

export default async function CreatorPage() {
  const user = await requireUser();
  const c = await getCreatorByUser(user.id);
  const pkgs = c ? await getPackages(c.id) : [];

  const banner = !c ? null : {
    pending: { Icon: Clock, cls: 'bg-amber-soft text-amber', t: 'Application under review', d: 'We review every creator by hand, usually within a day. You can keep editing your profile and prepare packages meanwhile.' },
    approved: { Icon: CheckCircle2, cls: 'bg-moss-soft text-moss', t: c.is_listed ? 'You’re live in the marketplace' : 'Your listing is paused', d: c.is_listed ? 'Developers can find and order from you.' : 'Hidden from browse. Existing orders continue as normal.' },
    rejected: { Icon: XCircle, cls: 'bg-signal-soft text-signal-dark', t: 'Application not approved', d: c.review_note ?? 'Update your profile and save to re-apply.' },
    suspended: { Icon: Ban, cls: 'bg-signal-soft text-signal-dark', t: 'Account suspended', d: c.review_note ?? 'Contact support for details.' },
  }[c.status];

  return (
    <>
      <PageHeader
        title={c ? 'My listing' : 'Become a creator'}
        sub={c ? 'Your public profile and the packages developers can order.' : 'Tell us about your channel. Approved creators get pre-funded orders from Roblox developers.'}
        actions={c?.status === 'approved' ? <div className="flex gap-2"><Link href={`/creators/${c.slug}`} className="btn btn-outline">View public page</Link><ListedToggle listed={!!c.is_listed} /></div> : undefined}
      />
      {banner && (
        <div className={`mb-6 flex gap-3 rounded-2xl px-5 py-4 ${banner.cls}`}>
          <banner.Icon size={20} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">{banner.t}</p><p className="mt-0.5 text-sm opacity-90">{banner.d}</p></div>
        </div>
      )}
      {c?.status === 'suspended' ? null : (
        <div className="space-y-8">
          <section className="card p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold">Profile</h2>
            <ProfileEditor c={c ? { displayName: c.display_name, headline: c.headline, bio: c.bio, platform: c.platform, youtubeUrl: c.youtube_url ?? '', tiktokUrl: c.tiktok_url ?? '', followers: c.followers, avgViews: c.avg_views, niches: c.niches } : null} />
          </section>
          {c && (
            <section className="card p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold">Packages</h2>
              <p className="mt-1 text-sm text-ink-3">Fixed-price offers. Developers order these directly. You receive the price minus the platform fee.</p>
              <PackagesEditor feeBps={config.feeBps} packages={pkgs.map((p) => ({ id: p.id, title: p.title, description: p.description, price: p.price, deliveryDays: p.delivery_days, revisions: p.revisions }))} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

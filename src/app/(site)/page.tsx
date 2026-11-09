import Link from 'next/link';
import { ArrowRight, BadgeCheck, Check, LifeBuoy, Search, ShieldCheck, Tag } from 'lucide-react';
import { Shell } from '@/components/marketing/shell';
import { CreatorCard } from '@/components/creator-card';
import { Avatar } from '@/components/avatar';
import { TikTokIcon, YouTubeIcon } from '@/components/icons';
import { featuredCreators } from '@/lib/creators';
import { config } from '@/lib/config';
import { NICHES } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const STEPS = [
  ['Find a creator', 'Filter by platform, genre, audience size and price. Every channel is reviewed by our team before it can list.'],
  ['Book a package', 'Pick a fixed-price package and send your game and brief. Your payment moves into escrow and the creator can see the order is funded.'],
  ['Review the delivery', 'The creator posts the video and sends you the link. Approve it, or ask for a revision.'],
  ['Release the funds', 'Approve and the creator is paid. If something goes wrong, support steps in and the escrow protects you.'],
];

const TRUST = [
  [ShieldCheck, 'Escrow on every order', 'Funds are locked until you approve.'],
  [BadgeCheck, 'Verified channels', 'Ownership proven, stats pulled live.'],
  [Tag, 'Fixed prices', 'See the price before you commit.'],
  [LifeBuoy, 'Dispute support', 'A person reads every dispute.'],
] as const;

const FAQ = [
  ['How does escrow work?', 'When you place an order, the price is taken from your CreatorLink balance and held on the order. The creator is paid only after you approve the delivery, or after the 72-hour review window passes. If they decline, miss the deadline, or lose a dispute, the full amount returns to your balance.'],
  ['What does it cost?', `Ordering is free for developers. You pay the package price and nothing on top. Creators pay a ${config.feeBps / 100}% service fee on completed orders only. There are no listing fees or subscriptions.`],
  ['Can I pay with US dollars?', 'Yes. Creators price each package in Robux or USD. Add dollars to your wallet by card (processed by Stripe), and creators cash out to their bank. Robux deposits and withdrawals go through Roblox gamepasses, confirmed by our team, usually within a day.'],
  ['How do I know a creator is real?', 'Creators prove they own their channel by adding a one-time code to their YouTube description or TikTok bio, and their name and audience numbers are read directly from the platform, not typed in. A team member then reviews every application. Reviews only come from buyers who completed an order.'],
  ['What if the work isn’t what I asked for?', 'Request a revision first. Each package includes a set number. If you still can’t agree, open a dispute. Support reads the conversation and the delivery, then releases the funds or refunds you.'],
];

export default async function Home() {
  const creators = await featuredCreators(4);
  return (
    <Shell>
      {/* hero */}
      <section className="border-b border-line bg-paper">
        <div className="container-x grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <h1 className="font-display text-[42px] font-bold leading-[1.02] tracking-tightest sm:text-6xl lg:text-[64px]">
              Hire Roblox creators.
              <br />
              <span className="text-signal">Pay when the video is live.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
              Book YouTubers and TikTokers for fixed-price game promotions. Pay in Robux or US dollars. Your payment stays in escrow until you have seen the delivery and approved it.
            </p>

            <form action="/creators" className="mt-8 grid max-w-xl gap-2 rounded-2xl border border-line-strong bg-white p-2 shadow-lift sm:grid-cols-[1fr_1fr_auto]">
              <select name="niche" aria-label="Genre" className="h-11 rounded-lg bg-transparent px-3 text-[15px] outline-none hover:bg-paper-2 focus:bg-paper-2">
                <option value="">Any genre</option>
                {NICHES.map((n) => <option key={n}>{n}</option>)}
              </select>
              <select name="platform" aria-label="Platform" className="h-11 rounded-lg bg-transparent px-3 text-[15px] outline-none hover:bg-paper-2 focus:bg-paper-2">
                <option value="">Any platform</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
              </select>
              <button className="btn btn-signal h-11"><Search size={16} /> Find creators</button>
            </form>
            <p className="mt-4 text-sm text-ink-3">
              Are you a creator? <Link href="/signup?intent=creator" className="font-semibold text-ink underline underline-offset-4">Apply to list your channel</Link>
            </p>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* trust bar */}
      <section aria-label="Why CreatorLink" className="border-b border-line bg-white">
        <div className="container-x grid grid-cols-2 gap-x-6 gap-y-6 py-8 lg:grid-cols-4">
          {TRUST.map(([Icon, t, d]) => (
            <div key={t} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal"><Icon size={20} /></span>
              <div><p className="text-[15px] font-semibold leading-tight">{t}</p><p className="mt-1 text-sm leading-snug text-ink-3">{d}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* creators */}
      <section className="bg-paper py-16 sm:py-24">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Popular creators</h2>
              <p className="mt-2 text-ink-3">Real audience numbers, fixed prices and reviews from completed orders.</p>
            </div>
            <Link href="/creators" className="btn btn-outline">View all creators <ArrowRight size={15} /></Link>
          </div>
          {creators.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {creators.map((c) => <CreatorCard key={c.id} c={c} />)}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white/60 p-12 text-center">
              <p className="font-display text-xl font-bold">No creators listed yet</p>
              <p className="mx-auto mt-2 max-w-md text-ink-3">Approved creators will appear here. Be one of the first to list your channel.</p>
              <Link href="/signup?intent=creator" className="btn btn-primary mt-6">Apply as a creator</Link>
            </div>
          )}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="scroll-mt-16 border-y border-line bg-white py-16 sm:py-24">
        <div className="container-x">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-2xl border border-line bg-paper p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-paper tnum">{i + 1}</span>
                <h3 className="mt-5 font-display text-xl font-bold">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-3">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* escrow */}
      <section id="escrow" className="scroll-mt-16 bg-ink py-16 text-paper sm:py-24">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">How escrow protects you</h2>
            <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-paper/75">
              The moment you order, the price leaves your balance and is locked to that order. It only moves again when you approve, when a deadline passes, or when support rules on a dispute. Every movement appears on your ledger.
            </p>
            <dl className="mt-8 space-y-6">
              {[
                ['Automatic refunds', 'If the creator declines, doesn’t respond within 48 hours, or misses the deadline, your money returns to your balance.'],
                ['You decide when it’s done', 'Request revisions, then approve. If you don’t respond, funds release after a 72-hour review window.'],
                ['Disputes are reviewed by a person', 'Support reads the whole conversation and the delivery before releasing funds or refunding you.'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3">
                  <Check size={18} className="mt-1 shrink-0 text-signal" strokeWidth={3} />
                  <div><dt className="font-semibold">{t}</dt><dd className="mt-1 text-[15px] leading-relaxed text-paper/65">{d}</dd></div>
                </div>
              ))}
            </dl>
          </div>
          <Ledger />
        </div>
      </section>

      {/* two sides */}
      <section className="bg-paper-2 py-16 sm:py-24">
        <div className="container-x grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-white p-8 shadow-card sm:p-10">
            <h3 className="font-display text-2xl font-bold tracking-tight">For developers</h3>
            <p className="mt-3 text-ink-2">See real audience numbers, fixed prices and past reviews before you commit any money.</p>
            <ul className="mt-6 space-y-2.5 text-[15px] text-ink-2">
              {['Transparent, fixed-price packages', 'Chat and share files inside each order', 'Reviews only from completed orders'].map((t) => (
                <li key={t} className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-moss" strokeWidth={3} />{t}</li>
              ))}
            </ul>
            <Link href="/creators" className="btn btn-primary mt-8">Find a creator</Link>
          </div>
          <div className="rounded-3xl bg-signal p-8 text-white sm:p-10">
            <h3 className="font-display text-2xl font-bold tracking-tight">For creators</h3>
            <p className="mt-3 text-white/85">Set your own packages and prices, and work with developers whose funds are already locked in.</p>
            <ul className="mt-6 space-y-2.5 text-[15px] text-white/90">
              {['Orders arrive pre-funded', `You keep ${100 - config.feeBps / 100}% of every package`, 'Withdraw to your own gamepass'].map((t) => (
                <li key={t} className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0" strokeWidth={3} />{t}</li>
              ))}
            </ul>
            <Link href="/signup?intent=creator" className="btn mt-8 bg-white text-ink hover:bg-paper">Apply as a creator</Link>
          </div>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="scroll-mt-16 py-16 sm:py-24">
        <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.7fr]">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
            <p className="mt-4 text-ink-3">
              Something else? Email <a className="font-medium text-ink underline underline-offset-4" href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>.
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="relative h-4 w-4 shrink-0" aria-hidden>
                    <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 bg-ink" />
                    <span className="absolute left-1/2 top-0 h-4 w-0.5 -translate-x-1/2 bg-ink transition group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="border-t border-line bg-white py-14">
        <div className="container-x flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Ready to promote your game?</h2>
            <p className="mt-1.5 text-ink-3">Create a free account and place your first order in minutes.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-signal btn-lg">Create an account</Link>
            <Link href="/creators" className="btn btn-outline btn-lg">Browse creators</Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}

/* ---------------------------------------------------------------- visuals */

function HeroVisual() {
  return (
    <div className="relative rounded-[28px] bg-signal-soft p-5 sm:p-8" aria-label="Example order">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name="Kai Plays" size={44} />
            <div>
              <p className="font-display font-bold leading-tight">Kai Plays</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-3"><TikTokIcon width={12} height={12} /> 60s gameplay short</p>
            </div>
          </div>
          <span className="badge bg-moss-soft text-moss">Delivered</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4 text-sm">
          <div><dt className="text-ink-3">Game</dt><dd className="font-semibold">Race Clicker X</dd></div>
          <div className="text-right"><dt className="text-ink-3">In escrow</dt><dd className="font-semibold tnum">R$ 1,200</dd></div>
        </dl>
        <ol className="mt-5 grid grid-cols-4 gap-1.5 text-xs font-semibold">
          {[['Funded', 'done'], ['Accepted', 'done'], ['Delivered', 'now'], ['Released', 'todo']].map(([l, s]) => (
            <li key={l}>
              <div className={`mb-2 h-1.5 rounded-full ${s === 'done' ? 'bg-ink' : s === 'now' ? 'bg-signal' : 'bg-paper-3'}`} />
              <span className={s === 'todo' ? 'text-ink-4' : ''}>{l}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex gap-2">
          <span className="btn btn-signal flex-1">Approve and release</span>
          <span className="btn btn-outline">Request revision</span>
        </div>
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-white p-4 shadow-lift sm:ml-10">
        <Avatar name="Kai Plays" size={30} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">Kai Plays</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">Video is up. I used your trailer clip at the end. Happy to change the hook if you want.</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-paper-2 px-2 py-1 text-xs font-medium"><YouTubeIcon width={13} height={13} className="text-[#E62117]" /> youtu.be/raceclickerx</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-paper shadow-lift sm:mr-10">
        <span className="flex items-center gap-2 text-sm font-medium"><Check size={16} className="text-signal" strokeWidth={3} /> Funds released to creator</span>
        <span className="font-display font-bold tnum">R$ 1,080</span>
      </div>
    </div>
  );
}

function Ledger() {
  const rows: [string, string, string, 'out' | 'in' | 'muted'][] = [
    ['Escrow hold', '60s gameplay short', '−1,200', 'out'],
    ['Creator accepted', 'Delivery due in 3 days', '', 'muted'],
    ['Buyer approved delivery', 'Funds released', '', 'muted'],
    ['Paid to creator', 'After 10% platform fee', '+1,080', 'in'],
    ['Platform fee', '10% of order', '120', 'muted'],
  ];
  return (
    <div className="rounded-2xl bg-white text-ink shadow-pop" aria-label="Example ledger">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="font-display font-bold">Order ledger</p>
        <span className="badge bg-moss text-white"><Check size={12} strokeWidth={3} /> Completed</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map(([t, d, v, k]) => (
          <li key={t} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div><p className="text-sm font-medium">{t}</p><p className="text-xs text-ink-3">{d}</p></div>
            {v && <span className={`text-sm font-semibold tnum ${k === 'in' ? 'text-moss' : k === 'muted' ? 'text-ink-3' : ''}`}>{v}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Check, FileVideo, MessageSquare, ShieldCheck, Wallet } from 'lucide-react';
import { Shell } from '@/components/marketing/shell';
import { CreatorCard } from '@/components/creator-card';
import { Avatar } from '@/components/avatar';
import { YouTubeIcon, TikTokIcon } from '@/components/icons';
import { featuredCreators } from '@/lib/creators';
import { config } from '@/lib/config';
import { NICHES } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const STEPS = [
  { n: '01', title: 'Find a creator', body: 'Filter by platform, genre, audience size and price. Every channel is reviewed by hand before it can list.' },
  { n: '02', title: 'Book a fixed-price promo', body: 'Pick a package, share your game and brief. Your Robux moves into escrow — the creator can see it’s funded.' },
  { n: '03', title: 'Review the delivery', body: 'The creator posts and sends you the link. Ask for a revision, or approve it if it’s what you asked for.' },
  { n: '04', title: 'Release the funds', body: 'Approve and the creator is paid. If something goes wrong, support steps in and the escrow protects you.' },
];

const FAQ = [
  ['How does escrow work?', 'When you place an order, the price is taken from your CreatorLink balance and held on the order. The creator is paid only after you approve the delivery (or the 72-hour review window passes). If they decline, miss the deadline, or lose a dispute, the full amount returns to your balance.'],
  ['What does it cost?', `Browsing and ordering is free for developers — you pay the package price and nothing on top. Creators pay a ${config.feeBps / 100}% service fee on completed orders only. There are no listing fees or subscriptions.`],
  ['How do I add or withdraw Robux?', 'Deposits and withdrawals go through Roblox gamepasses, so the transfers stay inside Roblox’s own rules. Request a deposit or withdrawal from your wallet and our team confirms it, usually within a day.'],
  ['How are creators vetted?', 'Every creator submits their channel, audience numbers and a pitch. We review each application manually and can suspend a listing at any time. Reviews only come from buyers who completed an order.'],
  ['What if the work isn’t what I asked for?', 'Request a revision first — each package includes a set number. If you still can’t agree, open a dispute. Support reads the conversation and the delivery, then releases the funds or refunds you.'],
];

export default function Home() {
  const creators = featuredCreators(4);
  return (
    <Shell>
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="dotgrid absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_70%_20%,black,transparent_70%)]" aria-hidden />
        <div className="container-x grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="animate-rise">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-white px-3 py-1 text-[13px] font-medium text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" /> For Roblox developers & creators
            </p>
            <h1 className="font-display text-[44px] font-bold leading-[0.98] tracking-tightest sm:text-6xl lg:text-[72px]">
              Hire Roblox creators.
              <br />
              <span className="text-signal">Pay when the video is live.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2 sm:text-lg">
              Book YouTubers and TikTokers for fixed-price game promos. Your Robux sits in escrow until you’ve seen the delivery and approved it — no chasing, no guessing.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/creators" className="btn btn-signal btn-lg">Browse creators <ArrowRight size={18} /></Link>
              <Link href="/signup?intent=creator" className="btn btn-outline btn-lg">Apply as a creator</Link>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              {['Escrow on every order', 'Creators reviewed by hand', `${config.feeBps / 100}% fee on completed orders only`].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check size={15} className="text-moss" strokeWidth={3} />{t}</li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* ------------------------------------------------------ genre ticker */}
      <section aria-label="Genres" className="overflow-hidden border-b border-line bg-ink py-4 text-paper">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-lg font-semibold tracking-tight">
          {[...NICHES, ...NICHES].map((n, i) => (
            <span key={i} className="flex items-center gap-10">
              {n}
              <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
            </span>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section id="how" className="scroll-mt-16 py-20 sm:py-28">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              A promotion in four steps, with a paper trail at every one.
            </h2>
          </div>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-white p-7">
                <span className="font-display text-sm font-bold text-signal tnum">{s.n}</span>
                <h3 className="mt-6 font-display text-xl font-bold leading-snug">{s.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-3">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ escrow */}
      <section id="escrow" className="scroll-mt-16 border-y border-line bg-paper-2 py-20 sm:py-28">
        <div className="container-x grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Escrow</p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">Nobody gets paid on a promise.</h2>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
              The moment you order, the price leaves your balance and is locked to that order. It only moves again when you approve, when a deadline passes, or when support rules on a dispute — and every movement is on your ledger.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                [ShieldCheck, 'Refunded automatically', 'Creator declines, doesn’t respond in 48 hours, or misses the deadline — your Robux comes straight back.'],
                [BadgeCheck, 'You decide when it’s done', 'Request revisions, then approve. If you go quiet, funds auto-release after a 72-hour review window.'],
                [MessageSquare, 'Disputes with a human', 'Support reads the whole thread and the delivery before releasing or refunding.'],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof ShieldCheck;
                return (
                  <li key={t as string} className="flex gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-ink shadow-card ring-1 ring-line"><I size={18} /></span>
                    <div>
                      <p className="font-semibold">{t as string}</p>
                      <p className="mt-0.5 text-[15px] leading-relaxed text-ink-3">{d as string}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <LedgerVisual />
        </div>
      </section>

      {/* -------------------------------------------------------- creators */}
      <section className="py-20 sm:py-28">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="eyebrow">Marketplace</p>
              <h2 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">Creators ready to book.</h2>
            </div>
            <Link href="/creators" className="btn btn-outline">View all creators <ArrowRight size={16} /></Link>
          </div>
          {creators.length > 0 ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {creators.map((c) => <CreatorCard key={c.id} c={c} />)}
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-white/60 p-12 text-center">
              <p className="font-display text-xl font-bold">The marketplace is just opening.</p>
              <p className="mx-auto mt-2 max-w-md text-ink-3">Approved creators will appear here. Be one of the first to list your channel.</p>
              <Link href="/signup?intent=creator" className="btn btn-primary mt-6">Apply as a creator</Link>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------- two sides */}
      <section className="pb-20 sm:pb-28">
        <div className="container-x grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-white p-8 shadow-card sm:p-10">
            <FileVideo size={26} className="text-signal" />
            <h3 className="mt-5 font-display text-3xl font-bold tracking-tight">For developers</h3>
            <p className="mt-3 text-ink-2">Skip the cold DMs. See real audience numbers, fixed prices and past reviews before you commit a single Robux.</p>
            <ul className="mt-6 space-y-2.5 text-[15px] text-ink-2">
              {['Transparent, fixed-price packages', 'Chat and share files inside each order', 'Reviews only from completed orders'].map((t) => (
                <li key={t} className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-moss" strokeWidth={3} />{t}</li>
              ))}
            </ul>
            <Link href="/creators" className="btn btn-primary mt-8">Find a creator</Link>
          </div>
          <div className="grain relative overflow-hidden rounded-3xl bg-ink p-8 text-paper shadow-card sm:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-signal/30 blur-3xl" aria-hidden />
            <Wallet size={26} className="relative text-signal" />
            <h3 className="relative mt-5 font-display text-3xl font-bold tracking-tight">For creators</h3>
            <p className="relative mt-3 text-paper/75">Turn your audience into Robux. Set your own packages and prices, and work with developers whose funds are already locked in.</p>
            <ul className="relative mt-6 space-y-2.5 text-[15px] text-paper/85">
              {['Orders arrive pre-funded — no chasing payment', 'You keep ' + (100 - config.feeBps / 100) + '% of every package', 'Withdraw to your own gamepass'].map((t) => (
                <li key={t} className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-signal" strokeWidth={3} />{t}</li>
              ))}
            </ul>
            <Link href="/signup?intent=creator" className="btn btn-signal relative mt-8">Apply as a creator</Link>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- faq */}
      <section id="faq" className="scroll-mt-16 border-t border-line py-20 sm:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight">Straight answers.</h2>
            <p className="mt-4 text-ink-3">
              Still stuck? Email <a className="font-medium text-ink underline decoration-signal underline-offset-4" href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>.
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="relative h-5 w-5 shrink-0" aria-hidden>
                    <span className="absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 bg-ink" />
                    <span className="absolute left-1/2 top-0 h-5 w-0.5 -translate-x-1/2 bg-ink transition group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- cta */}
      <section className="px-5 pb-16 sm:px-8">
        <div className="grain relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-signal px-8 py-16 text-center text-white sm:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,.18),transparent_60%)]" aria-hidden />
          <h2 className="relative mx-auto max-w-2xl font-display text-4xl font-bold leading-[1.03] tracking-tight sm:text-5xl">
            Your next 100,000 players are watching someone’s channel.
          </h2>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/creators" className="btn btn-lg bg-white text-ink hover:bg-paper">Browse creators</Link>
            <Link href="/signup" className="btn btn-lg border border-white/40 text-white hover:bg-white/10">Create a free account</Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}

/* ---------------------------------------------------------------- visuals */

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] animate-rise [animation-delay:120ms]" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-signal/10 via-transparent to-ink/5" />
      {/* order card */}
      <div className="rotate-[-1.2deg] rounded-2xl border border-line bg-white p-5 shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name="Kai Plays" size={44} />
            <div>
              <p className="font-display font-bold leading-tight">Kai Plays</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-3"><TikTokIcon width={12} height={12} /> 60s gameplay short</p>
            </div>
          </div>
          <span className="badge bg-sky-soft text-sky">In production</span>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-3 border-y border-line py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Game</p>
            <p className="font-semibold">Race Clicker X</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-3">In escrow</p>
            <p className="font-display text-2xl font-bold tnum"><span className="text-base opacity-50">R$</span> 3,000</p>
          </div>
        </div>
        <ol className="mt-5 grid grid-cols-4 gap-1 text-[11px] font-semibold">
          {[['Funded', 'done'], ['Accepted', 'done'], ['Delivered', 'now'], ['Released', 'todo']].map(([l, s]) => (
            <li key={l} className="text-center">
              <div className={`mx-auto mb-2 h-1.5 w-full rounded-full ${s === 'done' ? 'bg-ink' : s === 'now' ? 'bg-signal' : 'bg-paper-3'}`} />
              <span className={s === 'todo' ? 'text-ink-4' : 'text-ink'}>{l}</span>
            </li>
          ))}
        </ol>
      </div>
      {/* chat bubble */}
      <div className="relative -mt-3 ml-8 max-w-[300px] rotate-[1.6deg] rounded-2xl rounded-tl-md border border-line bg-white p-3.5 shadow-lift">
        <p className="text-[13px] font-semibold">Kai Plays</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-2">Video’s up! Used your new trailer clip at the end. Let me know if you want the hook changed.</p>
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-paper-2 px-2.5 py-2 text-xs font-medium">
          <TikTokIcon width={14} height={14} /> tiktok.com/@kaiplays/video/…
        </div>
      </div>
      {/* approve chip */}
      <div className="absolute -right-2 bottom-6 flex rotate-[2deg] items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-pop sm:-right-6">
        <Check size={15} className="text-signal" strokeWidth={3} /> Approve & release R$ 2,700
      </div>
      <YouTubeIcon className="absolute -left-4 top-10 hidden h-10 w-10 rotate-[-8deg] rounded-xl bg-white p-2 text-[#E62117] shadow-lift sm:block" />
    </div>
  );
}

function LedgerVisual() {
  const rows: [string, string, string, 'out' | 'in' | 'fee'][] = [
    ['Today, 14:02', 'Escrow hold · 60s gameplay short', '−3,000', 'out'],
    ['Today, 14:09', 'Creator accepted', '', 'fee'],
    ['Thu, 09:41', 'Delivery approved by buyer', '', 'fee'],
    ['Thu, 09:41', 'Released to creator', '+2,700', 'in'],
    ['Thu, 09:41', 'Platform fee (10%)', '300', 'fee'],
  ];
  return (
    <div className="rounded-2xl border border-line bg-white shadow-lift" aria-hidden>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="font-display font-bold">Order ledger</p>
        <span className="badge bg-moss-soft text-moss"><Check size={12} strokeWidth={3} /> Completed</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map(([t, d, v, k], i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium">{d}</p>
              <p className="text-xs text-ink-3">{t}</p>
            </div>
            {v && (
              <span className={`font-mono text-sm font-semibold tnum ${k === 'in' ? 'text-moss' : k === 'out' ? 'text-ink' : 'text-ink-3'}`}>{v}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between rounded-b-2xl bg-paper px-5 py-4 text-sm">
        <span className="text-ink-3">Every movement is recorded and visible to both sides.</span>
      </div>
    </div>
  );
}

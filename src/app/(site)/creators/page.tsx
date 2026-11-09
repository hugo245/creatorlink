import Link from 'next/link';
import type { Metadata } from 'next';
import { Search, SearchX } from 'lucide-react';
import { Shell } from '@/components/marketing/shell';
import { CreatorCard } from '@/components/creator-card';
import { FilterForm } from '@/components/filter-form';
import { EmptyState } from '@/components/ui';
import { listCreators, type Filters } from '@/lib/creators';
import { NICHES } from '@/lib/validators';

export const metadata: Metadata = { title: 'Browse Roblox creators', description: 'Find YouTube and TikTok creators for your Roblox game. Compare audiences, prices and reviews.' };
export const dynamic = 'force-dynamic';

const SORTS: [NonNullable<Filters['sort']>, string][] = [
  ['popular', 'Most popular'], ['rating', 'Top rated'], ['audience', 'Biggest audience'],
  ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['newest', 'Newest'],
];
const PRICES = [10, 25, 50, 100, 250]; // USD equivalent

export default async function Browse({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sort = SORTS.some(([k]) => k === sp.sort) ? (sp.sort as Filters['sort']) : 'popular';
  const platform = sp.platform === 'youtube' || sp.platform === 'tiktok' ? sp.platform : undefined;
  const niche = NICHES.find((n) => n === sp.niche);
  const maxUsd = PRICES.includes(Number(sp.max)) ? Number(sp.max) : undefined;
  const currency = sp.currency === 'USD' || sp.currency === 'ROBUX' ? sp.currency : undefined;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const { creators, total, pages } = await listCreators({ q: sp.q?.slice(0, 60), platform, niche, currency, maxUsd, sort, page, perPage: 12 });
  const filtered = !!(sp.q || platform || niche || maxUsd || currency);

  const pageHref = (p: number) => {
    const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    qs.set('page', String(p));
    return `/creators?${qs}`;
  };

  return (
    <Shell>
      <section className="border-b border-line bg-paper-2/60">
        <div className="container-x py-12 sm:py-16">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Browse creators</h1>
          <p className="mt-3 max-w-xl text-ink-2">Every creator’s channel ownership is verified and their numbers come straight from the platform. Prices are fixed and your money stays in escrow until you approve the work.</p>
        </div>
      </section>

      <div className="container-x py-8">
        <FilterForm>
          <div className="grid gap-3 md:grid-cols-[1.6fr_repeat(5,1fr)]">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
              <input type="search" name="q" defaultValue={sp.q} placeholder="Search by name or genre" aria-label="Search creators" className="field pl-10" />
            </div>
            <select name="platform" defaultValue={platform ?? ''} aria-label="Platform" className="field">
              <option value="">Any platform</option><option value="youtube">YouTube</option><option value="tiktok">TikTok</option>
            </select>
            <select name="niche" defaultValue={niche ?? ''} aria-label="Genre" className="field">
              <option value="">Any genre</option>{NICHES.map((n) => <option key={n}>{n}</option>)}
            </select>
            <select name="currency" defaultValue={currency ?? ''} aria-label="Currency" className="field">
              <option value="">Robux or USD</option><option value="ROBUX">Priced in Robux</option><option value="USD">Priced in USD</option>
            </select>
            <select name="max" defaultValue={maxUsd ?? ''} aria-label="Budget" className="field">
              <option value="">Any budget</option>{PRICES.map((p) => <option key={p} value={p}>Under ${p} value</option>)}
            </select>
            <select name="sort" defaultValue={sort} aria-label="Sort" className="field">
              {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        </FilterForm>

        <div className="mb-5 mt-6 flex items-center justify-between text-sm text-ink-3">
          <span>{total} creator{total === 1 ? '' : 's'}{filtered ? ' match your filters' : ''}</span>
          {filtered && <Link href="/creators" className="font-medium text-ink underline underline-offset-4">Clear filters</Link>}
        </div>

        {creators.length === 0 ? (
          <EmptyState icon={<SearchX size={22} />} title={filtered ? 'No creators match those filters' : 'No creators yet'} action={filtered ? <Link href="/creators" className="btn btn-outline">Clear filters</Link> : <Link href="/signup?intent=creator" className="btn btn-primary">Apply as a creator</Link>}>
            {filtered ? 'Try a wider budget or a different genre.' : 'Approved creators will show up here.'}
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{creators.map((c) => <CreatorCard key={c.id} c={c} />)}</div>
        )}

        {pages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
            {page > 1 && <Link href={pageHref(page - 1)} className="btn btn-outline btn-sm">Previous</Link>}
            <span className="px-3 text-sm text-ink-3 tnum">Page {page} of {pages}</span>
            {page < pages && <Link href={pageHref(page + 1)} className="btn btn-outline btn-sm">Next</Link>}
          </nav>
        )}
      </div>
    </Shell>
  );
}

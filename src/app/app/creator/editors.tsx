'use client';

import { useState } from 'react';
import { BadgeCheck, Copy, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { ActionButton } from '@/components/action-button';
import { NICHES } from '@/lib/validators';
import { linkChannelAction, refreshStatsAction, removePackage, saveDetailsAction, savePackageAction, toggleListed, verifyChannelAction } from '@/app/actions/creator';
import { Money, PlatformIcons } from '@/components/ui';
import { compact, timeAgo } from '@/lib/format';
import { fromUnits, type Currency } from '@/lib/money';

type Yt = { url: string; title: string | null; thumb: string | null; subs: number | null; avgViews: number | null; videos: number | null; verified: boolean; syncedAt: number | null };
type Tt = { url: string; title: string | null; followers: number | null; likes: number | null; verified: boolean; syncedAt: number | null };

export function ListedToggle({ listed }: { listed: boolean }) {
  return <ActionButton action={toggleListed} className="btn btn-outline">{listed ? 'Pause listing' : 'Resume listing'}</ActionButton>;
}

/* --------------------------------------------------------------- channels */

export function ChannelLinker({ disabled, lookupEnabled, code, youtube, tiktok }: { disabled: boolean; lookupEnabled: boolean; code: string | null; youtube: Yt | null; tiktok: Tt | null }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <ChannelCard platform="youtube" data={youtube} code={code} disabled={disabled} lookupEnabled={lookupEnabled} />
      <ChannelCard platform="tiktok" data={tiktok} code={code} disabled={disabled} lookupEnabled={false} />
    </div>
  );
}

function ChannelCard({ platform, data, code, disabled, lookupEnabled }: { platform: 'youtube' | 'tiktok'; data: Yt | Tt | null; code: string | null; disabled: boolean; lookupEnabled: boolean }) {
  const name = platform === 'youtube' ? 'YouTube' : 'TikTok';
  const where = platform === 'youtube' ? 'your channel description (YouTube Studio → Customization → Basic info)' : 'your TikTok bio (Edit profile → Bio)';
  return (
    <div className="rounded-2xl border border-line p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-lg font-bold"><PlatformIcons platform={platform} size={18} /> {name}</p>
        {data?.verified && <span className="inline-flex items-center gap-1 rounded-full bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky"><BadgeCheck size={13} /> Verified</span>}
      </div>

      {!data ? (
        <ActionForm action={linkChannelAction} className="space-y-3">
          {(s) => (
            <>
              <input type="hidden" name="platform" value={platform} />
              <Field label={platform === 'youtube' ? 'Channel link' : 'Profile link'} name={`url-${platform}`} error={s?.fields?.url} hint={platform === 'youtube' ? 'youtube.com/@yourhandle' : 'tiktok.com/@yourhandle'}>
                <input id={`url-${platform}`} name="url" disabled={disabled} className="field" placeholder={platform === 'youtube' ? 'https://youtube.com/@…' : 'https://tiktok.com/@…'} />
              </Field>
              <Notice state={s} />
              <SubmitButton className="btn btn-primary btn-sm" pendingText="Looking up…">Look up {name}</SubmitButton>
              {platform === 'youtube' && !lookupEnabled && <p className="text-xs text-ink-3">Automatic lookup is off on this server, so an admin will check your channel by hand.</p>}
            </>
          )}
        </ActionForm>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            {'thumb' in data && data.thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.thumb} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" width={48} height={48} />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{data.title ?? 'Channel linked'}</p>
              <a href={data.url} target="_blank" rel="noopener noreferrer nofollow" className="truncate text-xs text-ink-3 underline">{data.url.replace(/^https?:\/\/(www\.)?/, '')}</a>
            </div>
          </div>
          {'subs' in data ? (
            <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-paper-2 p-3 text-sm">
              <div><dt className="text-xs text-ink-3">Subscribers</dt><dd className="font-semibold tnum">{data.subs !== null ? compact(data.subs) : 'n/a'}</dd></div>
              <div><dt className="text-xs text-ink-3">Avg. views</dt><dd className="font-semibold tnum">{data.avgViews !== null ? compact(data.avgViews) : 'n/a'}</dd></div>
              <div><dt className="text-xs text-ink-3">Videos</dt><dd className="font-semibold tnum">{data.videos !== null ? compact(data.videos) : 'n/a'}</dd></div>
            </dl>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-paper-2 p-3 text-sm">
              <div><dt className="text-xs text-ink-3">Followers</dt><dd className="font-semibold tnum">{data.followers !== null ? compact(data.followers) : 'n/a'}</dd></div>
              <div><dt className="text-xs text-ink-3">Likes</dt><dd className="font-semibold tnum">{data.likes !== null ? compact(data.likes) : 'n/a'}</dd></div>
            </dl>
          )}

          {data.verified ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-3">
              <span>{data.syncedAt ? `Stats updated ${timeAgo(data.syncedAt)}` : 'Stats sync daily'}</span>
              <ActionButton action={() => refreshStatsAction(platform)} className="btn btn-outline btn-sm"><RefreshCw size={13} /> Refresh</ActionButton>
            </div>
          ) : (
            <div className="mt-4 space-y-3 rounded-lg border border-amber/30 bg-amber-soft p-4 text-sm">
              <p className="font-semibold text-amber">Prove this {name} account is yours</p>
              <p className="text-ink-2">Add this code anywhere in {where}, save, then press Verify. You can remove it afterwards.</p>
              <div className="flex items-center gap-2">
                <code className="rounded-md bg-white px-3 py-1.5 font-mono text-base font-bold tracking-wide">{code}</code>
                <button type="button" onClick={() => code && navigator.clipboard?.writeText(code)} className="btn btn-ghost btn-sm" aria-label="Copy code"><Copy size={14} /></button>
              </div>
              <ActionButton action={() => verifyChannelAction(platform)} className="btn btn-signal btn-sm">Verify {name}</ActionButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- details */

export function DetailsEditor({ name, headline, bio, niches: initial }: { name: string; headline: string; bio: string; niches: string[] }) {
  const [niches, setNiches] = useState<string[]>(initial);
  return (
    <ActionForm action={saveDetailsAction} className="mt-5 space-y-5">
      {(s) => (
        <>
          <Field label="Public name" name="name" hint="Taken from your verified channel so nobody can pose as someone else.">
            <input id="name" value={name} disabled className="field bg-paper-2 text-ink-3" />
          </Field>
          <Field label="Headline" name="headline" error={s?.fields?.headline} hint="One line that sells you. Shown on your card.">
            <input id="headline" name="headline" defaultValue={headline} maxLength={90} className="field" placeholder="e.g. Punchy 60-second shorts for simulators and obbies" />
          </Field>
          <Field label="About you" name="bio" error={s?.fields?.bio} hint="What do you make, who watches, and what do developers get from working with you?">
            <textarea id="bio" name="bio" rows={6} maxLength={1200} defaultValue={bio} className="field" />
          </Field>
          <fieldset>
            <legend className="label">Genres you cover <span className="font-normal text-ink-3">(up to 5)</span></legend>
            <div className="flex flex-wrap gap-2">
              {NICHES.map((n) => {
                const on = niches.includes(n);
                return (
                  <label key={n} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-white hover:border-ink'}`}>
                    <input type="checkbox" name="niches" value={n} checked={on} className="sr-only" onChange={() => setNiches(on ? niches.filter((x) => x !== n) : niches.length < 5 ? [...niches, n] : niches)} />
                    {n}
                  </label>
                );
              })}
            </div>
            {s?.fields?.niches && <p className="mt-1.5 text-xs font-medium text-signal-dark">{s.fields.niches}</p>}
          </fieldset>
          <Notice state={s} />
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/* --------------------------------------------------------------- packages */

type P = { id: string; title: string; description: string; price: number; currency: Currency; deliveryDays: number; revisions: number };

function PackageForm({ p, onDone }: { p: P | null; onDone: () => void }) {
  const [cur, setCur] = useState<Currency>(p?.currency ?? 'USD');
  return (
    <ActionForm action={savePackageAction.bind(null, p?.id ?? null)} onSuccess={onDone} className="space-y-4 rounded-xl border border-line-strong bg-paper p-5">
      {(s) => (
        <>
          <Field label="Title" name="title" error={s?.fields?.title}><input id="title" name="title" defaultValue={p?.title} maxLength={60} className="field" placeholder="e.g. 60s gameplay short" /></Field>
          <Field label="What’s included" name="description" error={s?.fields?.description}><textarea id="description" name="description" rows={2} defaultValue={p?.description} maxLength={400} className="field" /></Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Currency" name="currency">
              <select id="currency" name="currency" value={cur} onChange={(e) => setCur(e.target.value as Currency)} className="field"><option value="USD">US dollars</option><option value="ROBUX">Robux</option></select>
            </Field>
            <Field label={cur === 'USD' ? 'Price (USD)' : 'Price (R$)'} name="price" error={s?.fields?.price} hint={cur === 'USD' ? 'Minimum $3.' : 'Minimum R$ 50.'}>
              <input id="price" name="price" type="number" step={cur === 'USD' ? '0.01' : '1'} min={cur === 'USD' ? 3 : 50} defaultValue={p ? fromUnits(p.price, p.currency) : undefined} className="field" />
            </Field>
            <Field label="Delivery (days)" name="deliveryDays" error={s?.fields?.deliveryDays}><input id="deliveryDays" name="deliveryDays" type="number" min={1} max={60} defaultValue={p?.deliveryDays ?? 3} className="field" /></Field>
            <Field label="Revisions" name="revisions" error={s?.fields?.revisions}><input id="revisions" name="revisions" type="number" min={0} max={10} defaultValue={p?.revisions ?? 1} className="field" /></Field>
          </div>
          <Notice state={s} />
          <div className="flex gap-2"><SubmitButton pendingText="Saving…">{p ? 'Save package' : 'Add package'}</SubmitButton><button type="button" onClick={onDone} className="btn btn-ghost">Cancel</button></div>
        </>
      )}
    </ActionForm>
  );
}

export function PackagesEditor({ packages, feeBps }: { packages: P[]; feeBps: number }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  return (
    <div className="mt-5 space-y-3">
      {packages.length === 0 && editing !== 'new' && <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-3">Add at least one package to appear in the marketplace.</p>}
      {packages.map((p) =>
        editing === p.id ? <PackageForm key={p.id} p={p} onDone={() => setEditing(null)} /> : (
          <div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border border-line p-4">
            <div className="min-w-0">
              <p className="font-semibold">{p.title}</p>
              <p className="text-sm text-ink-3">{p.deliveryDays}d delivery · {p.revisions} revision{p.revisions === 1 ? '' : 's'} · you earn <Money n={p.price - Math.floor((p.price * feeBps) / 10_000)} c={p.currency} /></p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Money n={p.price} c={p.currency} className="font-display text-lg font-bold" />
              <button onClick={() => setEditing(p.id)} className="btn btn-ghost h-9 w-9 px-0" aria-label={`Edit ${p.title}`}><Pencil size={16} /></button>
              <ActionButton action={() => removePackage(p.id)} confirm="Remove?" danger className="btn btn-ghost h-9 w-9 px-0"><Trash2 size={16} /></ActionButton>
            </div>
          </div>
        ),
      )}
      {editing === 'new' ? <PackageForm p={null} onDone={() => setEditing(null)} /> : packages.length < 6 && (
        <button onClick={() => setEditing('new')} className="btn btn-outline"><Plus size={16} /> Add package</button>
      )}
    </div>
  );
}

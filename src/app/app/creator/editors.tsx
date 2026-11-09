'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { ActionButton } from '@/components/action-button';
import { NICHES } from '@/lib/validators';
import { saveProfile, savePackageAction, removePackage, toggleListed } from '@/app/actions/account';
import { Robux } from '@/components/ui';

type Profile = { displayName: string; headline: string; bio: string; platform: 'youtube' | 'tiktok' | 'both'; youtubeUrl: string; tiktokUrl: string; followers: number; avgViews: number; niches: string[] };

export function ListedToggle({ listed }: { listed: boolean }) {
  return <ActionButton action={toggleListed} className="btn btn-outline">{listed ? 'Pause listing' : 'Resume listing'}</ActionButton>;
}

export function ProfileEditor({ c }: { c: Profile | null }) {
  const [platform, setPlatform] = useState(c?.platform ?? 'youtube');
  const [niches, setNiches] = useState<string[]>(c?.niches ?? []);
  return (
    <ActionForm action={saveProfile} className="mt-5 space-y-5">
      {(s) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Display name" name="displayName" error={s?.fields?.displayName}><input id="displayName" name="displayName" defaultValue={c?.displayName} maxLength={40} className="field" /></Field>
            <Field label="Platform" name="platform">
              <select id="platform" name="platform" value={platform} onChange={(e) => setPlatform(e.target.value as Profile['platform'])} className="field">
                <option value="youtube">YouTube</option><option value="tiktok">TikTok</option><option value="both">Both</option>
              </select>
            </Field>
          </div>
          <Field label="Headline" name="headline" error={s?.fields?.headline} hint="One line that sells you. Shown on your card."><input id="headline" name="headline" defaultValue={c?.headline} maxLength={90} className="field" placeholder="e.g. Punchy 60-second shorts for simulators and obbies" /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            {platform !== 'tiktok' && <Field label="YouTube channel link" name="youtubeUrl" error={s?.fields?.youtubeUrl}><input id="youtubeUrl" name="youtubeUrl" defaultValue={c?.youtubeUrl} className="field" placeholder="https://youtube.com/@…" /></Field>}
            {platform !== 'youtube' && <Field label="TikTok profile link" name="tiktokUrl" error={s?.fields?.tiktokUrl}><input id="tiktokUrl" name="tiktokUrl" defaultValue={c?.tiktokUrl} className="field" placeholder="https://tiktok.com/@…" /></Field>}
            <Field label="Total followers / subscribers" name="followers" error={s?.fields?.followers}><input id="followers" name="followers" type="number" min={0} defaultValue={c?.followers} className="field" /></Field>
            <Field label="Average views per video" name="avgViews" error={s?.fields?.avgViews}><input id="avgViews" name="avgViews" type="number" min={0} defaultValue={c?.avgViews} className="field" /></Field>
          </div>
          <Field label="About you" name="bio" error={s?.fields?.bio} hint="What do you make, who watches, and what do developers get from working with you?"><textarea id="bio" name="bio" rows={6} maxLength={1200} defaultValue={c?.bio} className="field" /></Field>
          <fieldset>
            <legend className="label">Genres you cover <span className="font-normal text-ink-3">(up to 5)</span></legend>
            <div className="flex flex-wrap gap-2">
              {NICHES.map((n) => {
                const on = niches.includes(n);
                return (
                  <label key={n} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-white hover:border-ink'}`}>
                    <input type="checkbox" name="niches" value={n} checked={on} className="sr-only"
                      onChange={() => setNiches(on ? niches.filter((x) => x !== n) : niches.length < 5 ? [...niches, n] : niches)} />
                    {n}
                  </label>
                );
              })}
            </div>
            {s?.fields?.niches && <p className="mt-1.5 text-xs font-medium text-signal-dark">{s.fields.niches}</p>}
          </fieldset>
          <Notice state={s} />
          <SubmitButton pendingText="Saving…" className="btn btn-primary btn-lg">{c ? 'Save profile' : 'Submit application'}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

type P = { id: string; title: string; description: string; price: number; deliveryDays: number; revisions: number };

function PackageForm({ p, onDone }: { p: P | null; onDone: () => void }) {
  return (
    <ActionForm action={savePackageAction.bind(null, p?.id ?? null)} onSuccess={onDone} className="space-y-4 rounded-xl border border-line-strong bg-paper p-5">
      {(s) => (
        <>
          <Field label="Title" name="title" error={s?.fields?.title}><input id="title" name="title" defaultValue={p?.title} maxLength={60} className="field" placeholder="e.g. 60s gameplay short" /></Field>
          <Field label="What’s included" name="description" error={s?.fields?.description}><textarea id="description" name="description" rows={2} defaultValue={p?.description} maxLength={400} className="field" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price (R$)" name="price" error={s?.fields?.price}><input id="price" name="price" type="number" min={50} defaultValue={p?.price} className="field" /></Field>
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
              <p className="text-sm text-ink-3">{p.deliveryDays}d delivery · {p.revisions} revision{p.revisions === 1 ? '' : 's'} · you earn <Robux n={p.price - Math.floor((p.price * feeBps) / 10_000)} /></p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Robux n={p.price} className="font-display text-lg font-bold" />
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

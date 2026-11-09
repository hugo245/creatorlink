'use client';

import Link from 'next/link';
import { useState } from 'react';
import clsx from 'clsx';
import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { signup } from '@/app/actions/auth';

export function SignupForm({ intent: initial }: { intent: 'developer' | 'creator' }) {
  const [intent, setIntent] = useState(initial);
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-ink-3">Free to join. You can do both. Switch any time.</p>
      <ActionForm action={signup} className="mt-8 space-y-5">
        {(s) => (
          <>
            <fieldset>
              <legend className="label">I’m here to</legend>
              <div className="grid grid-cols-2 gap-2">
                {([['developer', 'Promote my game'], ['creator', 'Work as a creator']] as const).map(([v, l]) => (
                  <label key={v} className={clsx('cursor-pointer rounded-lg border px-3 py-3 text-center text-sm font-semibold transition', intent === v ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-white hover:border-ink')}>
                    <input type="radio" name="intent" value={v} checked={intent === v} onChange={() => setIntent(v)} className="sr-only" />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Username" name="username" error={s?.fields?.username}>
              <input id="username" name="username" autoComplete="username" defaultValue={s?.values?.username} maxLength={20} className="field" />
            </Field>
            <Field label="Email" name="email" error={s?.fields?.email}>
              <input id="email" name="email" type="email" autoComplete="email" defaultValue={s?.values?.email} className="field" />
            </Field>
            <Field label="Password" name="password" error={s?.fields?.password} hint="At least 8 characters.">
              <input id="password" name="password" type="password" autoComplete="new-password" className="field" />
            </Field>
            <Notice state={s} />
            <SubmitButton className="btn btn-signal btn-lg w-full" pendingText="Creating account…">Create account</SubmitButton>
            <p className="text-xs leading-relaxed text-ink-3">By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
          </>
        )}
      </ActionForm>
      <p className="mt-6 text-sm text-ink-3">Already have an account? <Link href="/login" className="font-semibold text-ink underline underline-offset-4">Log in</Link></p>
    </>
  );
}

'use client';

import Link from 'next/link';
import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { login } from '@/app/actions/auth';

export function LoginForm({ next, reset }: { next: string; reset?: boolean }) {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-ink-3">Log in to manage your orders and wallet.</p>
      {reset && <p className="mt-5 rounded-lg bg-moss-soft px-3 py-2.5 text-sm text-moss" role="status">Password updated. Log in with your new password.</p>}
      <ActionForm action={login} className="mt-8 space-y-5">
        {(s) => (
          <>
            <input type="hidden" name="next" value={next} />
            <Field label="Email" name="email" error={s?.fields?.email}>
              <input id="email" name="email" type="email" autoComplete="email" defaultValue={s?.values?.email} className="field" autoFocus />
            </Field>
            <Field label="Password" name="password" error={s?.fields?.password}>
              <input id="password" name="password" type="password" autoComplete="current-password" className="field" />
              <Link href="/forgot" className="mt-2 inline-block text-xs font-semibold text-ink-3 underline underline-offset-4 hover:text-ink">Forgot your password?</Link>
            </Field>
            <Notice state={s} />
            <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Logging in…">Log in</SubmitButton>
          </>
        )}
      </ActionForm>
      <p className="mt-6 text-sm text-ink-3">New here? <Link href="/signup" className="font-semibold text-ink underline underline-offset-4">Create an account</Link></p>
    </>
  );
}

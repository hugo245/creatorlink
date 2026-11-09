'use client';

import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { requestPasswordReset } from '@/app/actions/auth';

export function ForgotForm() {
  return (
    <ActionForm action={requestPasswordReset} className="mt-8 space-y-5">
      {(s) => (
        <>
          <Field label="Email" name="email" error={s?.fields?.email}><input id="email" name="email" type="email" autoComplete="email" className="field" autoFocus /></Field>
          <Notice state={s} />
          <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Sending…">Send reset link</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

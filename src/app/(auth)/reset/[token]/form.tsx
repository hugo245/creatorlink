'use client';

import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { resetPassword } from '@/app/actions/auth';

export function ResetForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPassword.bind(null, token)} className="mt-8 space-y-5">
      {(s) => (
        <>
          <Field label="New password" name="password" error={s?.fields?.password} hint="At least 8 characters."><input id="password" name="password" type="password" autoComplete="new-password" className="field" autoFocus /></Field>
          <Notice state={s} />
          <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Saving…">Update password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

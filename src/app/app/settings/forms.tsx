'use client';

import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { Avatar } from '@/components/avatar';
import { changePassword, updateProfile } from '@/app/actions/auth';

export function ProfileForm({ username, email, roblox, avatar }: { username: string; email: string; roblox: string; avatar: string | null }) {
  return (
    <ActionForm action={updateProfile} className="mt-5 space-y-5">
      {(s) => (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={username} src={avatar} size={64} />
            <div className="flex-1">
              <label htmlFor="avatar" className="label">Profile picture</label>
              <input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-paper-3 file:px-3 file:py-2 file:text-sm file:font-semibold" />
              {s?.fields?.avatar && <p className="mt-1.5 text-xs font-medium text-signal-dark">{s.fields.avatar}</p>}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Username" name="u"><input id="u" value={username} disabled className="field bg-paper-2 text-ink-3" /></Field>
            <Field label="Email" name="e"><input id="e" value={email} disabled className="field bg-paper-2 text-ink-3" /></Field>
          </div>
          <Field label="Roblox username" name="roblox_username" error={s?.fields?.roblox_username} hint="Used to match deposits and withdrawals.">
            <input id="roblox_username" name="roblox_username" defaultValue={roblox} maxLength={20} className="field" />
          </Field>
          <Notice state={s} />
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePassword} resetOnSuccess className="mt-5 max-w-md space-y-5">
      {(s) => (
        <>
          <Field label="Current password" name="current" error={s?.fields?.current}><input id="current" name="current" type="password" autoComplete="current-password" className="field" /></Field>
          <Field label="New password" name="next" error={s?.fields?.next} hint="At least 8 characters."><input id="next" name="next" type="password" autoComplete="new-password" className="field" /></Field>
          <Notice state={s} />
          <SubmitButton pendingText="Updating…">Update password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

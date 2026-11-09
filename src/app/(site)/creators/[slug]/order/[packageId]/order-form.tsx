'use client';

import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { placeOrder } from '@/app/actions/orders';

export function OrderForm({ packageId, disabled }: { packageId: string; disabled: boolean }) {
  return (
    <ActionForm action={placeOrder} className="space-y-5">
      {(s) => (
        <>
          <input type="hidden" name="packageId" value={packageId} />
          <Field label="Game name" name="gameName" error={s?.fields?.gameName}>
            <input id="gameName" name="gameName" defaultValue={s?.values?.gameName} maxLength={60} className="field" placeholder="e.g. Race Clicker X" />
          </Field>
          <Field label="Game link" name="gameUrl" error={s?.fields?.gameUrl} hint="The roblox.com page of your game.">
            <input id="gameUrl" name="gameUrl" type="url" defaultValue={s?.values?.gameUrl} className="field" placeholder="https://www.roblox.com/games/…" />
          </Field>
          <Field label="Brief for the creator" name="brief" error={s?.fields?.brief} hint="What should the video show? Any key features, updates, codes or things to avoid?">
            <textarea id="brief" name="brief" defaultValue={s?.values?.brief} rows={7} maxLength={1500} className="field" />
          </Field>
          <Notice state={s} />
          <SubmitButton className="btn btn-signal btn-lg w-full" pendingText="Placing order…">{disabled ? 'Place order (insufficient balance)' : 'Place order & hold funds'}</SubmitButton>
          <p className="text-center text-xs text-ink-3">You can message the creator right after ordering.</p>
        </>
      )}
    </ActionForm>
  );
}

'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import clsx from 'clsx';
import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { ActionButton } from '@/components/action-button';
import * as A from '@/app/actions/orders';

export type ActionsProps = {
  id: string;
  role: 'buyer' | 'seller' | 'admin';
  status: string;
  late: boolean;
  revisionsLeft: number;
  reviewed: boolean;
  price: number;
};

function Disclosure({ label, children, tone = 'plain' }: { label: string; children: React.ReactNode; tone?: 'plain' | 'danger' }) {
  return (
    <details className="group rounded-xl border border-line bg-white open:shadow-card">
      <summary className={clsx('flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden', tone === 'danger' && 'text-signal-dark')}>
        {label}<span className="text-ink-4 transition group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

function StarInput() {
  const [v, setV] = useState(0);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      <input type="hidden" name="rating" value={v || ''} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={v === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setV(n)} className="rounded p-0.5">
          <Star size={28} className={n <= v ? 'fill-amber text-amber' : 'text-line-strong'} />
        </button>
      ))}
    </div>
  );
}

export function OrderActions(p: ActionsProps) {
  const { id, role, status } = p;
  const dispute = (
    <Disclosure label="Something wrong? Open a dispute" tone="danger">
      <ActionForm action={A.openDispute.bind(null, id)} className="space-y-3">
        {(s) => (
          <>
            <Field label="What happened?" name="reason" error={s?.fields?.reason} hint="Support will read this and the conversation, then decide.">
              <textarea id="reason" name="reason" rows={3} maxLength={600} className="field" />
            </Field>
            <Notice state={s} />
            <SubmitButton className="btn btn-danger" pendingText="Opening…">Open dispute</SubmitButton>
          </>
        )}
      </ActionForm>
    </Disclosure>
  );

  if (role === 'admin') return null;

  if (role === 'seller') {
    if (status === 'pending') {
      return (
        <div className="space-y-3">
          <ActionButton action={() => A.acceptOrder(id)} className="btn btn-signal btn-lg w-full">Accept order</ActionButton>
          <Disclosure label="Decline this order">
            <ActionForm action={A.declineOrder.bind(null, id)} className="space-y-3">
              {(s) => (
                <>
                  <Field label="Reason (optional)" name="reason"><input id="reason" name="reason" maxLength={300} className="field" placeholder="e.g. Not a fit for my audience" /></Field>
                  <Notice state={s} />
                  <SubmitButton className="btn btn-danger" pendingText="Declining…">Decline & refund buyer</SubmitButton>
                </>
              )}
            </ActionForm>
          </Disclosure>
        </div>
      );
    }
    if (status === 'active') {
      return (
        <div className="space-y-3">
          <ActionForm action={A.deliverOrder.bind(null, id)} className="space-y-4">
            {(s) => (
              <>
                <Field label="Link to your video" name="url" error={s?.fields?.url} hint="YouTube, TikTok, Drive, Streamable or Medal.">
                  <input id="url" name="url" type="url" className="field" placeholder="https://" />
                </Field>
                <Field label="Note to the buyer (optional)" name="note" error={s?.fields?.note}>
                  <textarea id="note" name="note" rows={3} maxLength={800} className="field" />
                </Field>
                <Notice state={s} />
                <SubmitButton className="btn btn-signal btn-lg w-full" pendingText="Delivering…">Deliver work</SubmitButton>
              </>
            )}
          </ActionForm>
          {dispute}
        </div>
      );
    }
    if (status === 'delivered') return <div className="space-y-3"><p className="text-sm text-ink-3">Waiting for the buyer to review. Funds auto-release if they don’t respond in time.</p>{dispute}</div>;
    return null;
  }

  // buyer
  if (status === 'pending') {
    return <ActionButton action={() => A.cancelOrder(id)} confirm="Cancel and refund your payment?" className="btn btn-outline">Cancel order</ActionButton>;
  }
  if (status === 'active') {
    return (
      <div className="space-y-3">
        {p.late && <ActionButton action={() => A.cancelOrder(id)} confirm="The deadline passed. Cancel and refund?" danger className="btn btn-danger">Deadline missed: cancel & refund</ActionButton>}
        {dispute}
      </div>
    );
  }
  if (status === 'delivered') {
    return (
      <div className="space-y-3">
        <ActionButton action={() => A.approveOrder(id)} confirm="Release the funds to the creator? This can’t be undone." className="btn btn-signal btn-lg w-full">Approve & release funds</ActionButton>
        {p.revisionsLeft > 0 && (
          <Disclosure label={`Request a revision (${p.revisionsLeft} left)`}>
            <ActionForm action={A.requestRevision.bind(null, id)} className="space-y-3">
              {(s) => (
                <>
                  <Field label="What should change?" name="message" error={s?.fields?.message}><textarea id="message" name="message" rows={3} maxLength={600} className="field" /></Field>
                  <Notice state={s} />
                  <SubmitButton className="btn btn-primary" pendingText="Sending…">Send feedback</SubmitButton>
                </>
              )}
            </ActionForm>
          </Disclosure>
        )}
        {dispute}
      </div>
    );
  }
  if (status === 'completed' && !p.reviewed) {
    return (
      <ActionForm action={A.leaveReview.bind(null, id)} className="space-y-4">
        {(s) => (
          <>
            <p className="font-display text-lg font-bold">How did it go?</p>
            <StarInput />
            {s?.fields?.rating && <p className="text-xs font-medium text-signal-dark">{s.fields.rating}</p>}
            <Field label="Your review (optional)" name="body" error={s?.fields?.body}><textarea id="body" name="body" rows={3} maxLength={800} className="field" placeholder="Was the creator professional? Did it bring players?" /></Field>
            <Notice state={s} />
            <SubmitButton className="btn btn-primary" pendingText="Posting…">Post review</SubmitButton>
          </>
        )}
      </ActionForm>
    );
  }
  return null;
}

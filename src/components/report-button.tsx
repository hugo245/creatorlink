'use client';

import { Flag } from 'lucide-react';
import { ActionForm, Field, Notice, SubmitButton } from '@/components/form';
import { submitReport } from '@/app/actions/account';

const REASONS: [string, string][] = [
  ['impersonation', 'Pretending to be someone else'],
  ['scam', 'Scam or fraud'],
  ['fake_stats', 'Fake or inflated numbers'],
  ['off_platform', 'Asking to pay outside CreatorLink'],
  ['abuse', 'Harassment or inappropriate content'],
  ['other', 'Something else'],
];

export function ReportButton({ targetType, targetId, label = 'Report' }: { targetType: 'creator' | 'order' | 'user'; targetId: string; label?: string }) {
  return (
    <details className="group inline-block text-left">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-signal-dark [&::-webkit-details-marker]:hidden">
        <Flag size={13} /> {label}
      </summary>
      <div className="mt-3 w-[min(320px,80vw)] rounded-xl border border-line bg-white p-4 shadow-lift">
        <ActionForm action={submitReport.bind(null, targetType, targetId)} resetOnSuccess className="space-y-3">
          {(s) => (
            <>
              <Field label="What’s wrong?" name="reason" error={s?.fields?.reason}>
                <select id="reason" name="reason" className="field h-10 text-sm" defaultValue="">
                  <option value="" disabled>Choose a reason</option>
                  {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Details (optional)" name="details"><textarea id="details" name="details" rows={3} maxLength={800} className="field text-sm" /></Field>
              <Notice state={s} />
              <SubmitButton className="btn btn-primary btn-sm" pendingText="Sending…">Send report</SubmitButton>
            </>
          )}
        </ActionForm>
      </div>
    </details>
  );
}

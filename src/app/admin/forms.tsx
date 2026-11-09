'use client';

import { ActionForm, Notice, SubmitButton } from '@/components/form';
import { ActionButton } from '@/components/action-button';
import { adminAdjustBalance, adminResolveDispute, adminResolvePayment, adminResolveReport, adminReviewCreator, adminSetBan, adminTogglePayoutHold, adminVerifyEmail } from '@/app/actions/account';
import { adminVerifyPlatform } from '@/app/actions/creator';

export function CreatorReviewForm({ id, status }: { id: string; status: string }) {
  const buttons = status === 'approved'
    ? [['suspend', 'Suspend', 'btn btn-danger'] as const]
    : status === 'suspended' ? [['reinstate', 'Reinstate', 'btn btn-primary'] as const]
    : [['approve', 'Approve', 'btn btn-primary'] as const, ['reject', 'Reject', 'btn btn-danger'] as const];
  return (
    <div className="space-y-2">
      {buttons.map(([d, label, cls]) => (
        <ActionForm key={d} action={adminReviewCreator.bind(null, id, d)} className="flex flex-wrap items-center gap-2">
          {(s) => (<>
            <input name="note" placeholder={d === 'approve' || d === 'reinstate' ? 'Note (optional)' : 'Reason (shown to creator)'} className="field h-9 min-w-0 flex-1 text-sm" />
            <SubmitButton className={`${cls} btn-sm`}>{label}</SubmitButton>
            {s?.error && <p className="basis-full text-xs font-medium text-signal-dark">{s.error}</p>}
          </>)}
        </ActionForm>
      ))}
    </div>
  );
}

export function DisputeForm({ id }: { id: string }) {
  return (
    <div className="space-y-2">
      {(['release', 'refund'] as const).map((o) => (
        <ActionForm key={o} action={adminResolveDispute.bind(null, id, o)} className="flex flex-wrap items-center gap-2">
          {(s) => (<>
            <input name="note" placeholder="Explain the decision (both parties see this)" className="field h-9 min-w-0 flex-1 text-sm" />
            <SubmitButton className={`btn btn-sm ${o === 'release' ? 'btn-primary' : 'btn-danger'}`}>{o === 'release' ? 'Release to creator' : 'Refund buyer'}</SubmitButton>
            {s?.error && <p className="basis-full text-xs font-medium text-signal-dark">{s.error}</p>}
          </>)}
        </ActionForm>
      ))}
    </div>
  );
}

export function PaymentForm({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {([true, false] as const).map((approve) => (
        <ActionForm key={String(approve)} action={adminResolvePayment.bind(null, id, approve)} className="flex items-center gap-2">
          {() => (<>
            <input name="note" placeholder="Note" className="field h-9 w-36 text-sm" />
            <SubmitButton className={`btn btn-sm ${approve ? 'btn-primary' : 'btn-danger'}`}>{approve ? 'Mark done' : 'Reject'}</SubmitButton>
          </>)}
        </ActionForm>
      ))}
    </div>
  );
}

export function BanButton({ id, banned }: { id: string; banned: boolean }) {
  return <ActionButton action={() => adminSetBan(id, !banned)} confirm={banned ? 'Reinstate user?' : 'Suspend and sign out?'} danger={!banned} className="btn btn-outline btn-sm">{banned ? 'Reinstate' : 'Suspend'}</ActionButton>;
}

export function AdjustForm({ id }: { id: string }) {
  return (
    <ActionForm action={adminAdjustBalance.bind(null, id)} resetOnSuccess className="flex items-center gap-2">
      {(s) => (<>
        <select name="currency" aria-label="Currency" className="field h-9 w-24 text-sm"><option value="ROBUX">Robux</option><option value="USD">USD</option></select>
        <input name="amount" type="number" step="any" placeholder="±" className="field h-9 w-20 text-sm" />
        <input name="note" placeholder="Reason" className="field h-9 w-36 text-sm" />
        <SubmitButton className="btn btn-outline btn-sm">Adjust</SubmitButton>
        <Notice state={s?.error ? s : null} />
      </>)}
    </ActionForm>
  );
}

export function HoldButton({ id, held }: { id: string; held: boolean }) {
  return <ActionButton action={() => adminTogglePayoutHold(id)} className="btn btn-outline btn-sm">{held ? 'Release payout hold' : 'Hold payouts'}</ActionButton>;
}

export function VerifyEmailButton({ id }: { id: string }) {
  return <ActionButton action={() => adminVerifyEmail(id)} className="btn btn-outline btn-sm">Mark email verified</ActionButton>;
}

export function VerifyPlatformButton({ id, platform }: { id: string; platform: 'youtube' | 'tiktok' }) {
  return (
    <ActionButton action={() => adminVerifyPlatform(id, platform)} confirm={`Confirm you saw the code on their ${platform === 'youtube' ? 'YouTube channel' : 'TikTok bio'}?`} className="btn btn-outline btn-sm">
      Verify {platform === 'youtube' ? 'YouTube' : 'TikTok'} manually
    </ActionButton>
  );
}

export function ReportForm({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(['resolved', 'dismissed'] as const).map((st) => (
        <ActionForm key={st} action={adminResolveReport.bind(null, id, st)} className="flex items-center gap-2">
          {() => (<>
            <input name="note" placeholder="Note" className="field h-9 w-40 text-sm" />
            <SubmitButton className={`btn btn-sm ${st === 'resolved' ? 'btn-primary' : 'btn-outline'}`}>{st === 'resolved' ? 'Resolve' : 'Dismiss'}</SubmitButton>
          </>)}
        </ActionForm>
      ))}
    </div>
  );
}

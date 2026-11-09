'use client';

import { useState, useTransition } from 'react';
import { MailWarning } from 'lucide-react';
import { resendVerification } from '@/app/actions/auth';

export function VerifyBanner({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">
      <MailWarning size={18} className="shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Verify your email to order, sell or withdraw.</span> We sent a link to {email}.
        {msg && <span className="ml-2 font-medium text-ink">{msg}</span>}
      </p>
      <button disabled={pending} onClick={() => start(async () => { const r = await resendVerification(); setMsg(r?.error ?? r?.message ?? null); })} className="btn btn-outline btn-sm">
        Resend email
      </button>
    </div>
  );
}

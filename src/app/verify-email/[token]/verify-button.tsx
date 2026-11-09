'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { verifyEmail } from '@/app/actions/auth';

export function VerifyButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  if (result?.ok) {
    return (
      <div className="mt-8" role="status">
        <p className="rounded-lg bg-moss-soft px-3 py-2.5 text-sm font-medium text-moss">Email verified. Thank you.</p>
        <Link href="/app" className="btn btn-primary btn-lg mt-5 w-full">Continue to dashboard</Link>
      </div>
    );
  }
  return (
    <div className="mt-8">
      <button disabled={pending} onClick={() => start(async () => setResult(await verifyEmail(token)))} className="btn btn-signal btn-lg w-full">
        {pending ? 'Verifying…' : 'Verify my email'}
      </button>
      {result?.error && <p role="alert" className="mt-3 text-sm font-medium text-signal-dark">{result.error}</p>}
    </div>
  );
}

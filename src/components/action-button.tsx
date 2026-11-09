'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import type { ActionState } from './form';

/** Button that runs a server action with optional confirm step and inline error. */
export function ActionButton({
  action, children, className = 'btn btn-outline', confirm, danger,
}: { action: () => Promise<ActionState>; children: React.ReactNode; className?: string; confirm?: string; danger?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const run = () =>
    start(async () => {
      setErr(null);
      const r = await action();
      if (r?.error) setErr(r.error);
      setAsking(false);
    });
  return (
    <div>
      {asking ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-paper-2 p-2 text-sm">
          <span className="px-1 font-medium">{confirm}</span>
          <button onClick={run} disabled={pending} className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}>
            {pending && <Loader2 size={14} className="animate-spin" />} Yes, continue
          </button>
          <button onClick={() => setAsking(false)} className="btn btn-ghost btn-sm">Never mind</button>
        </div>
      ) : (
        <button onClick={() => (confirm ? setAsking(true) : run())} disabled={pending} className={className}>
          {pending && <Loader2 size={16} className="animate-spin" />}
          {children}
        </button>
      )}
      {err && <p role="alert" className="mt-2 text-sm font-medium text-signal-dark">{err}</p>}
    </div>
  );
}

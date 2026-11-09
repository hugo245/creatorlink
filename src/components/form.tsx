'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export type ActionState = { ok?: boolean; error?: string; message?: string; fields?: Record<string, string>; values?: Record<string, string> } | null;
export type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function SubmitButton({ children, className = 'btn btn-primary', pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} aria-busy={pending}>
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function Notice({ state }: { state: ActionState }) {
  if (!state || (!state.error && !state.message)) return null;
  const bad = !!state.error;
  return (
    <div
      role={bad ? 'alert' : 'status'}
      className={clsx('flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm', bad ? 'bg-signal-soft text-signal-dark' : 'bg-moss-soft text-moss')}
    >
      {bad ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
      <span>{state.error || state.message}</span>
    </div>
  );
}

/** Form wired to a server action with inline errors. Pass `resetOnSuccess` for one-shot forms. */
export function ActionForm({
  action, children, className, resetOnSuccess = false, onSuccess,
}: {
  action: Action;
  children: (state: ActionState) => React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} noValidate>
      {children(state)}
    </form>
  );
}

export function Field({
  label, name, error, hint, children, className,
}: { label: string; name: string; error?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-signal-dark" id={`${name}-err`}>{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

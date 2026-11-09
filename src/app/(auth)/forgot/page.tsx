import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotForm } from './form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-ink-3">Enter your email and we’ll send you a link to choose a new one.</p>
      <ForgotForm />
      <p className="mt-6 text-sm text-ink-3"><Link href="/login" className="font-semibold text-ink underline underline-offset-4">Back to log in</Link></p>
    </>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from '@/components/logo';
import { VerifyButton } from './verify-button';

export const metadata: Metadata = { title: 'Verify your email', robots: { index: false } };

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen flex-col items-center px-5 py-10">
      <Logo />
      <div className="my-auto w-full max-w-sm text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">Confirm your email</h1>
        <p className="mt-2 text-ink-3">One click and your account is ready to order, sell and withdraw.</p>
        <VerifyButton token={token} />
        <p className="mt-6 text-sm text-ink-3"><Link href="/app" className="underline underline-offset-4">Go to dashboard</Link></p>
      </div>
    </div>
  );
}

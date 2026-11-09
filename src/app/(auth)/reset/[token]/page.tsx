import type { Metadata } from 'next';
import { ResetForm } from './form';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-ink-3">You’ll be signed out everywhere and asked to log in again.</p>
      <ResetForm token={token} />
    </>
  );
}

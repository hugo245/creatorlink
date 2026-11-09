import type { Metadata } from 'next';
import { SignupForm } from './form';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const { intent } = await searchParams;
  return <SignupForm intent={intent === 'creator' ? 'creator' : 'developer'} />;
}

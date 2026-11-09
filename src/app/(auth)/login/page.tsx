import type { Metadata } from 'next';
import { LoginForm } from './form';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  return <LoginForm next={next ?? ''} reset={reset === '1'} />;
}

import Link from 'next/link';
import { Shell } from '@/components/marketing/shell';

export default function NotFound() {
  return (
    <Shell>
      <div className="container-x flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="font-display text-8xl font-bold tracking-tightest text-signal">404</p>
        <h1 className="mt-4 font-display text-3xl font-bold">That page doesn’t exist.</h1>
        <p className="mt-2 text-ink-3">It may have moved, or the creator’s profile isn’t public.</p>
        <div className="mt-8 flex gap-3"><Link href="/" className="btn btn-primary">Home</Link><Link href="/creators" className="btn btn-outline">Browse creators</Link></div>
      </div>
    </Shell>
  );
}

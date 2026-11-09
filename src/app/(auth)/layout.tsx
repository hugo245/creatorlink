import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { Logo } from '@/components/logo';
import { getUser } from '@/lib/auth';
import { config } from '@/lib/config';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getUser()) redirect('/app');
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">{children}</div>
        <p className="text-xs text-ink-3">© {new Date().getFullYear()} CreatorLink</p>
      </div>
      <aside className="hidden bg-ink p-14 text-paper lg:flex lg:flex-col lg:justify-end" aria-hidden>
        <div className="max-w-md">
          <p className="font-display text-4xl font-bold leading-[1.05] tracking-tight">Promotions you can pay for with confidence.</p>
          <ul className="mt-8 space-y-3 text-paper/80">
            {['Funds held in escrow until you approve', 'Creators reviewed by hand', `Creators keep ${100 - config.feeBps / 100}% of every package`].map((t) => (
              <li key={t} className="flex items-center gap-3"><Check size={16} className="text-signal" strokeWidth={3} />{t}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

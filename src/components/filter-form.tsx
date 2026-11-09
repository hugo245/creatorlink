'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

/** GET form that re-submits on change (debounced for text) so filtering feels instant without client state. */
export function FilterForm({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const go = () => {
    const fd = new FormData(ref.current!);
    const qs = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (typeof v === 'string' && v) qs.set(k, v);
    router.push(`/creators${qs.size ? `?${qs}` : ''}`, { scroll: false });
  };
  return (
    <form
      ref={ref}
      method="get"
      action="/creators"
      onSubmit={(e) => { e.preventDefault(); go(); }}
      onChange={(e) => {
        clearTimeout(timer.current);
        const t = e.target as unknown as HTMLInputElement;
        timer.current = setTimeout(go, t.type === 'search' ? 350 : 0);
      }}
    >
      {children}
    </form>
  );
}

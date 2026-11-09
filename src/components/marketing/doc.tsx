import { Shell } from './shell';

export function Doc({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <Shell>
      <div className="container-x max-w-3xl py-14 sm:py-20">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {updated && <p className="mt-3 text-sm text-ink-3">Last updated {updated}</p>}
        <div className="mt-10 space-y-5 text-[16px] leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_a]:underline [&_a]:underline-offset-4">
          {children}
        </div>
      </div>
    </Shell>
  );
}

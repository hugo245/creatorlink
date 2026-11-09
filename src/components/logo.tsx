import Link from 'next/link';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#16130F" />
      <rect x="6" y="11" width="13" height="10" rx="5" fill="none" stroke="#FAF8F4" strokeWidth="2.4" />
      <rect x="13" y="11" width="13" height="10" rx="5" fill="none" stroke="#E8381C" strokeWidth="2.4" />
    </svg>
  );
}

export function Logo({ href = '/', light = false, markOnlyMobile = false }: { href?: string; light?: boolean; markOnlyMobile?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="CreatorLink home">
      <LogoMark />
      <span className={`font-display text-[19px] font-bold tracking-tight ${markOnlyMobile ? 'hidden min-[480px]:inline' : ''} ${light ? 'text-paper' : 'text-ink'}`}>
        Creator<span className="text-signal">Link</span>
      </span>
    </Link>
  );
}

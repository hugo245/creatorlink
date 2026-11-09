import clsx from 'clsx';
import { Star, Check, Clock, X, AlertTriangle, Truck, RotateCcw, Loader, BadgeCheck } from 'lucide-react';
import { fmtMoney, type Currency } from '@/lib/money';
import { YouTubeIcon, TikTokIcon } from './icons';
import type { OrderStatus } from '@/lib/orders';

export function Stars({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  if (count === 0) return <span className="text-xs text-ink-3">New</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold tnum" title={`${value.toFixed(1)} out of 5`}>
      <Star size={size} className="fill-amber text-amber" aria-hidden />
      {value.toFixed(1)}
      {count !== undefined && <span className="font-normal text-ink-3">({count})</span>}
    </span>
  );
}

export function PlatformIcons({ platform, size = 16 }: { platform: 'youtube' | 'tiktok' | 'both'; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {platform !== 'tiktok' && <YouTubeIcon width={size} height={size} className="text-[#E62117]" aria-label="YouTube" />}
      {platform !== 'youtube' && <TikTokIcon width={size} height={size} className="text-ink" aria-label="TikTok" />}
    </span>
  );
}

const STATUS: Record<OrderStatus, { label: string; cls: string; Icon: typeof Check }> = {
  pending: { label: 'Awaiting creator', cls: 'bg-amber-soft text-amber', Icon: Clock },
  active: { label: 'In production', cls: 'bg-sky-soft text-sky', Icon: Loader },
  delivered: { label: 'Delivered', cls: 'bg-moss-soft text-moss', Icon: Truck },
  completed: { label: 'Completed', cls: 'bg-moss text-white', Icon: Check },
  disputed: { label: 'In dispute', cls: 'bg-signal-soft text-signal-dark', Icon: AlertTriangle },
  cancelled: { label: 'Cancelled', cls: 'bg-paper-3 text-ink-2', Icon: X },
  declined: { label: 'Declined', cls: 'bg-paper-3 text-ink-2', Icon: X },
  refunded: { label: 'Refunded', cls: 'bg-paper-3 text-ink-2', Icon: RotateCcw },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return (
    <span className={clsx('badge', s.cls)}>
      <s.Icon size={12} strokeWidth={2.5} aria-hidden />
      {s.label}
    </span>
  );
}

export function Money({ n, c = 'ROBUX', className }: { n: number; c?: Currency; className?: string }) {
  const text = fmtMoney(n, c);
  const i = text.search(/[0-9]/);
  return (
    <span className={clsx('tnum whitespace-nowrap', className)}>
      <span className={clsx('font-semibold opacity-60', c === 'ROBUX' && 'mr-[0.15em]')}>{text.slice(0, i).trim()}</span>
      {text.slice(i)}
    </span>
  );
}

/** Both wallets side by side, e.g. "R$ 19,000 · $50". */
export function DualMoney({ robux, usd, className }: { robux: number; usd: number; className?: string }) {
  return (
    <span className={clsx('whitespace-nowrap', className)}>
      <Money n={robux} /> <span className="px-1 opacity-30">|</span> <Money n={usd} c="USD" />
    </span>
  );
}

export function VerifiedBadge({ className, label = 'Verified channel' }: { className?: string; label?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full bg-sky-soft px-2 py-0.5 text-xs font-semibold text-sky', className)} title="Channel ownership confirmed by CreatorLink">
      <BadgeCheck size={13} aria-hidden /> {label}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-white/50 px-6 py-14 text-center">
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-paper-2 text-ink-3">{icon}</div>}
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-ink-3">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-ink-3">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

export const robux = (n: number) => `R$ ${Math.round(n).toLocaleString('en-US')}`;

export const compact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: n >= 1_000_000 ? 1 : n >= 10_000 ? 0 : 1 }).format(n);

export function timeAgo(ts: number, ref = Date.now()): string {
  const s = Math.round((ref - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d > 330 ? 'numeric' : undefined });
}

export function dateTime(ts: number) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function dateShort(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "in 2d 4h" / "3h overdue" */
export function relativeDue(ts: number, ref = Date.now()): { text: string; overdue: boolean } {
  const diff = ts - ref;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(m, 1)}m`;
  return diff >= 0 ? { text: `in ${span}`, overdue: false } : { text: `${span} overdue`, overdue: true };
}

export const rating = (sum: number, count: number) => (count ? sum / count : 0);

export function plural(n: number, one: string, many = one + 's') {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

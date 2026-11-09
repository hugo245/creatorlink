const PALETTE = [
  ['#FDEBE6', '#C42B13'], ['#E4F2EA', '#1F7A4D'], ['#E6EDFB', '#2457C5'],
  ['#FBF1DC', '#8A5A12'], ['#EFE7FA', '#5B34A3'], ['#E3F3F5', '#0E6B78'],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ name, src, size = 40, className = '' }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [bg, fg] = PALETTE[hash(name) % PALETTE.length];
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/files/${src}`} alt="" width={size} height={size} style={style} className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, background: bg, color: fg }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold uppercase ${className}`}
    >
      {name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?'}
    </span>
  );
}

import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';
import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = config.appUrl;
  const creators = all<{ slug: string }>("SELECT slug FROM creators WHERE status = 'approved' AND is_listed = 1");
  return [
    ...['', '/creators', '/safety', '/terms', '/privacy'].map((p) => ({ url: `${base}${p}` })),
    ...creators.map((c) => ({ url: `${base}/creators/${c.slug}` })),
  ];
}

import fs from 'node:fs';
import { Readable } from 'node:stream';
import { getUser } from '@/lib/auth';
import { get } from '@/lib/db';
import { MIME_BY_EXT, resolveUpload } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Serves uploads. Avatars are public; chat files only to the two parties on the order (and admins). */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const rel = parts.join('/');
  const ext = rel.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_BY_EXT[ext];
  if (!mime || parts.some((p) => p.includes('..'))) return new Response('Not found', { status: 404 });

  let isPublic = false;
  if (parts[0] === 'avatars' && parts.length === 2) isPublic = true;
  else if (parts[0] === 'chat' && parts.length === 3) {
    const user = await getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
    const o = get<{ buyer_id: string; seller_user_id: string }>('SELECT buyer_id, seller_user_id FROM orders WHERE id = ?', parts[1]);
    if (!o || (o.buyer_id !== user.id && o.seller_user_id !== user.id && user.role !== 'admin')) return new Response('Not found', { status: 404 });
  } else return new Response('Not found', { status: 404 });

  const full = resolveUpload(rel);
  if (!full) return new Response('Not found', { status: 404 });
  const stat = fs.statSync(full);
  const range = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
  const headers: Record<string, string> = {
    'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
    'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, max-age=3600',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
  if (range) {
    const start = range[1] ? parseInt(range[1], 10) : 0;
    const end = range[2] ? Math.min(parseInt(range[2], 10), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(full, { start, end })) as ReadableStream, {
      status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(full)) as ReadableStream, { headers: { ...headers, 'Content-Length': String(stat.size) } });
}

import { getUser } from '@/lib/auth';
import { get } from '@/lib/db';
import { MIME_BY_EXT, readUpload } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Serves uploads. Avatars are public; chat files only to the two parties on the order (and admins). */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const rel = parts.join('/');
  const mime = MIME_BY_EXT[rel.split('.').pop()?.toLowerCase() ?? ''];
  if (!mime) return new Response('Not found', { status: 404 });

  let isPublic = false;
  if (parts[0] === 'avatars' && parts.length === 2) isPublic = true;
  else if (parts[0] === 'chat' && parts.length === 3) {
    const user = await getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
    const o = await get<{ buyer_id: string; seller_user_id: string }>('SELECT buyer_id, seller_user_id FROM orders WHERE id = ?', parts[1]);
    if (!o || (o.buyer_id !== user.id && o.seller_user_id !== user.id && user.role !== 'admin')) return new Response('Not found', { status: 404 });
  } else return new Response('Not found', { status: 404 });

  const file = await readUpload(rel, req.headers.get('range'));
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(file.status === 416 ? null : file.body, {
    status: file.status,
    headers: {
      ...file.headers, 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
      'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, max-age=3600',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}

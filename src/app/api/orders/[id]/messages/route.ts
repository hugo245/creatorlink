import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getOrder } from '@/lib/orders';
import { orderMessages } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const o = getOrder((await params).id);
  if (!o || (o.buyer_id !== user.id && o.seller_user_id !== user.id && user.role !== 'admin')) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ messages: orderMessages(o.id), status: o.status }, { headers: { 'Cache-Control': 'no-store' } });
}

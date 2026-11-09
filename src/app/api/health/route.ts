import { NextResponse } from 'next/server';
import { get } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Liveness + database check for uptime monitors and load balancers. */
export async function GET() {
  try {
    await get('SELECT 1 AS ok');
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

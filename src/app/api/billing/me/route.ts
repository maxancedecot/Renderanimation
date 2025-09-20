import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { getBilling } from '@/lib/billing';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = String((session.user as any).id || '');
  const billing = await getBilling(uid);
  return NextResponse.json({ billing });
}


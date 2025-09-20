import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { getBilling } from '@/lib/billing';
// Using Stripe REST API directly to avoid SDK dependency

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = String((session.user as any).id || '');
  const rec = await getBilling(uid);
  if (!rec?.stripeCustomerId) return NextResponse.json({ error: 'no_customer' }, { status: 400 });

  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const returnUrl = process.env.BILLING_PORTAL_RETURN_URL || `${origin}/account`;
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.json({ error: 'missing_stripe_key' }, { status: 500 });
  const body = new URLSearchParams({ customer: rec.stripeCustomerId, return_url: returnUrl });
  const resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sk}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json().catch(() => ({} as any));
  if (!resp.ok || !data?.url) return NextResponse.json({ error: data?.error?.message || 'portal_failed' }, { status: 500 });
  return NextResponse.redirect(data.url as string, { status: 302 });
}

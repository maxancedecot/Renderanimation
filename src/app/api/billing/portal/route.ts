import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { getBilling } from '@/lib/billing';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = String(session.user.id);
  const rec = await getBilling(uid);
  if (!rec?.stripeCustomerId) return NextResponse.json({ error: 'no_customer' }, { status: 400 });

  const stripe = getStripe();
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const returnUrl = process.env.BILLING_PORTAL_RETURN_URL || `${origin}/account`;
  const sess = await stripe.billingPortal.sessions.create({ customer: rec.stripeCustomerId, return_url: returnUrl });
  return NextResponse.redirect(sess.url, { status: 302 });
}


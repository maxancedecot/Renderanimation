import { NextResponse } from 'next/server';
import { getBilling, planForPrice, setBilling, type BillingRecord } from '@/lib/billing';
import { findUserByEmail } from '@/lib/users';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id') || url.searchParams.get('session') || undefined;
  if (!sessionId) return NextResponse.json({ error: 'missing session_id' }, { status: 400 });
  const sk = process.env.STRIPE_SECRET_KEY || '';
  if (!sk) return NextResponse.json({ error: 'missing_stripe_key' }, { status: 500 });

  // Fetch Checkout Session with expands
  const sessResp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=customer`, {
    headers: { Authorization: `Bearer ${sk}` },
  });
  const session: any = await sessResp.json().catch(() => ({}));
  if (!sessResp.ok) return NextResponse.json({ error: session?.error?.message || 'fetch_session_failed' }, { status: 400 });

  const refUserId: string | undefined = session?.client_reference_id || undefined;
  const custAny: any = session?.customer;
  const customerId: string | undefined = typeof custAny === 'string' ? custAny : custAny?.id || undefined;
  const email: string | undefined = session?.customer_details?.email || session?.customer?.email || undefined;
  let subscription: any = session?.subscription;

  if (!subscription || typeof subscription !== 'object') {
    const subId: string | undefined = session?.subscription || undefined;
    if (subId) {
      const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
        headers: { Authorization: `Bearer ${sk}` },
      });
      subscription = await subResp.json().catch(() => ({}));
    }
  }

  const priceId: string | undefined = subscription?.items?.data?.[0]?.price?.id;
  const productId: string | undefined = subscription?.items?.data?.[0]?.price?.product;
  const status: BillingRecord['subscriptionStatus'] | undefined = subscription?.status as any;
  const currentPeriodEnd: number | undefined = subscription?.current_period_end as number | undefined;
  const quotas = priceId ? planForPrice(priceId) : null;

  const rec: BillingRecord = {
    stripeCustomerId: customerId,
    subscriptionStatus: status || 'active',
    priceId,
    productId,
    subscriptionId: (subscription?.id as string | undefined),
    videosTotal: quotas?.videosTotal ?? 0,
    videosRemaining: quotas?.videosTotal ?? 0,
    includes4k: quotas?.includes4k ?? false,
    currentPeriodEnd,
    lastUpdatedAt: new Date().toISOString(),
  };

  async function updateUser(userId: string) {
    const existing = (await getBilling(userId)) || ({} as BillingRecord);
    await setBilling(userId, { ...existing, ...rec });
  }

  if (refUserId) {
    await updateUser(refUserId);
    return NextResponse.json({ ok: true, mapped: 'client_reference_id' });
  }
  if (email) {
    const u = await findUserByEmail(email);
    if (u) {
      await updateUser(u.id);
      return NextResponse.json({ ok: true, mapped: 'email' });
    }
  }
  return NextResponse.json({ ok: false, error: 'user_not_mapped' }, { status: 404 });
}

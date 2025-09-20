import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { findUserByEmail } from '@/lib/users';
import { getBilling, planForPrice, setBilling, type BillingRecord, setCustomerIndex, setSubscriptionIndex, getUserIdBySubscription, getUserIdByCustomer } from '@/lib/billing';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Read raw body for signature verification
  const text = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) return NextResponse.json({ error: 'missing_webhook_secret' }, { status: 500 });

  // Verify Stripe signature (t=timestamp, v1=HMAC-SHA256 of `${t}.${payload}`)
  function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
    try {
      const parts = Object.fromEntries(header.split(',').map(kv => kv.split('=')) as any);
      const t = parts['t'];
      const v1 = parts['v1'];
      if (!t || !v1) return false;
      const data = `${t}.${payload}`;
      const mac = createHmac('sha256', secret).update(data, 'utf8').digest('hex');
      const a = Buffer.from(mac, 'utf8');
      const b = Buffer.from(String(v1), 'utf8');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch { return false; }
  }

  if (!verifyStripeSignature(text, sig, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(text); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const email: string | undefined = session?.customer_details?.email || session?.customer_email || undefined;
        const customerId: string | undefined = session?.customer || undefined;
        const subId: string | undefined = session?.subscription || undefined;
        const refUserId: string | undefined = session?.client_reference_id || undefined;

        // Helper to fetch subscription details
        async function fetchSub(subId?: string) {
          if (!subId) return {} as any;
          const sk = process.env.STRIPE_SECRET_KEY || '';
          const resp = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
            headers: { 'Authorization': `Bearer ${sk}` },
          });
          return await resp.json().catch(() => ({}));
        }

        const sub: any = await fetchSub(subId);
        const priceId: string | undefined = sub?.items?.data?.[0]?.price?.id;
        const productId: string | undefined = sub?.items?.data?.[0]?.price?.product;
        const status: BillingRecord['subscriptionStatus'] | undefined = sub?.status as any;
        const currentPeriodEnd: number | undefined = sub?.current_period_end as number | undefined;
        const subscriptionId: string | undefined = (sub?.id as string | undefined) || subId;
        const quotas = priceId ? planForPrice(priceId) : null;
        const rec: BillingRecord = {
          stripeCustomerId: customerId,
          subscriptionStatus: status || 'active',
          priceId,
          productId,
          subscriptionId,
          videosTotal: quotas?.videosTotal ?? 0,
          videosRemaining: quotas?.videosTotal ?? 0,
          includes4k: quotas?.includes4k ?? false,
          currentPeriodEnd,
          lastUpdatedAt: new Date().toISOString(),
        };

        // Prefer client_reference_id mapping
        if (refUserId) {
          const existing = (await getBilling(refUserId)) || {} as BillingRecord;
          await setBilling(refUserId, { ...existing, ...rec });
          if (customerId) await setCustomerIndex(customerId, refUserId);
          if (subscriptionId) await setSubscriptionIndex(subscriptionId, refUserId);
          break;
        }
        // Fallback: map by email
        if (email && customerId) {
          const u = await findUserByEmail(email);
          if (u) {
            const existing = (await getBilling(u.id)) || {} as BillingRecord;
            await setBilling(u.id, { ...existing, ...rec });
            if (customerId) await setCustomerIndex(customerId, u.id);
            if (subscriptionId) await setSubscriptionIndex(subscriptionId, u.id);
          }
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const subId: string = sub.id;
        const customerId: string = sub.customer;
        // Resolve user id
        let userId = await getUserIdBySubscription(subId);
        if (!userId && customerId) userId = await getUserIdByCustomer(customerId);
        if (!userId) break; // not mapped yet
        const priceId: string | undefined = sub?.items?.data?.[0]?.price?.id;
        const quotas = priceId ? planForPrice(priceId) : null;
        const newEnd: number = sub.current_period_end;
        const status: BillingRecord['subscriptionStatus'] = sub.status;
        const existing = (await getBilling(userId)) || {} as BillingRecord;
        const prevEnd = existing.currentPeriodEnd || 0;
        // If moved to a new period or plan changed, reset credits
        const videosTotal = quotas?.videosTotal ?? existing.videosTotal ?? 0;
        const includes4k = quotas?.includes4k ?? existing.includes4k ?? false;
        const shouldReset = newEnd > prevEnd;
        const updated: BillingRecord = {
          ...existing,
          stripeCustomerId: customerId || existing.stripeCustomerId,
          subscriptionId: subId,
          priceId: priceId || existing.priceId,
          productId: (sub?.items?.data?.[0]?.price?.product as string | undefined) || existing.productId,
          subscriptionStatus: status,
          videosTotal,
          includes4k,
          currentPeriodEnd: newEnd,
          videosRemaining: shouldReset ? videosTotal : (existing.videosRemaining ?? videosTotal),
          lastUpdatedAt: new Date().toISOString(),
        };
        await setBilling(userId, updated);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const customerId: string = sub.customer;
        const priceId: string | undefined = sub.items?.data?.[0]?.price?.id;
        const productId: string | undefined = sub.items?.data?.[0]?.price?.product;
        const status: BillingRecord['subscriptionStatus'] = sub.status;
        const currentPeriodEnd: number = sub.current_period_end;

        // We need to locate the user by customerId. Since we only stored it on checkout, we can scan known users in billing storage on demand (omitted for brevity),
        // or rely on mapping by email during checkout. Here we do a best-effort update by storing on existing linked users.
        // If you expect subscriptions created outside checkout, you may add a customer->user index.

        // For this template, we can’t efficiently reverse lookup by customerId without a DB; so we skip if no mapping exists.
        // In production, maintain a customer index in R2.

        // Try to update any user that already linked this customerId
        // (No reverse index; left as a TODO for larger scale.)
        // You can optionally fire an async job to backfill.
        const quotas = priceId ? planForPrice(priceId) : null;
        // No userId here; mapping handled above on checkout. Nothing to do if not mapped yet.
        // This implementation focuses on credits enforcement during generation using stored billing.
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'webhook handler failed' }, { status: 500 });
  }
}

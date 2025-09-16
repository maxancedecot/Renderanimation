import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { findUserByEmail } from '@/lib/users';
import { getBilling, planForPrice, setBilling, type BillingRecord } from '@/lib/billing';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const stripe = getStripe();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'missing webhook secret' }, { status: 500 });

  const text = await req.text();
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(text, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `webhook invalid: ${err?.message || err}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const email: string | undefined = session?.customer_details?.email || session?.customer_email || undefined;
        const customerId: string | undefined = session?.customer || undefined;
        const subId: string | undefined = session?.subscription || undefined;
        if (email && customerId) {
          const u = await findUserByEmail(email);
          if (u) {
            let priceId: string | undefined;
            let productId: string | undefined;
            let status: BillingRecord['subscriptionStatus'] | undefined;
            let currentPeriodEnd: number | undefined;
            if (subId) {
              const sub = await stripe.subscriptions.retrieve(subId);
              priceId = (sub.items.data[0]?.price?.id) as string | undefined;
              productId = (sub.items.data[0]?.price?.product) as string | undefined;
              status = sub.status as any;
              currentPeriodEnd = sub.current_period_end as number;
            }
            const quotas = priceId ? planForPrice(priceId) : null;
            const rec: BillingRecord = {
              stripeCustomerId: customerId,
              subscriptionStatus: status || 'active',
              priceId,
              productId,
              videosTotal: quotas?.videosTotal ?? 0,
              videosRemaining: quotas?.videosTotal ?? 0,
              includes4k: quotas?.includes4k ?? false,
              currentPeriodEnd,
              lastUpdatedAt: new Date().toISOString(),
            };
            const existing = (await getBilling(u.id)) || {} as BillingRecord;
            await setBilling(u.id, { ...existing, ...rec });
          }
        }
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

import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { getBilling, setBilling, setCustomerIndex } from '@/lib/billing';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const uid = String((session.user as any).id || '');
  const billing = await getBilling(uid);
  if (!billing) {
    return NextResponse.json({ error: 'no_customer' }, { status: 400 });
  }

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    return NextResponse.json({ error: 'missing_stripe_key' }, { status: 500 });
  }
  const stripeHeaders = { Authorization: `Bearer ${sk}` };

  async function verifyCustomer(customerId: string): Promise<boolean> {
    const resp = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, { headers: stripeHeaders });
    if (resp.ok) return true;
    if (resp.status === 404) return false;
    const data = await resp.json().catch(() => ({} as any));
    throw new Error(data?.error?.message || 'customer_lookup_failed');
  }

  async function findCustomerByEmail(email: string): Promise<string | null> {
    if (!email) return null;
    const params = new URLSearchParams({ email, limit: '1' });
    const resp = await fetch(`https://api.stripe.com/v1/customers?${params.toString()}`, { headers: stripeHeaders });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({} as any));
      throw new Error(data?.error?.message || 'customer_search_failed');
    }
    const data = await resp.json().catch(() => ({} as any));
    const found = Array.isArray(data?.data) && data.data.length > 0 ? data.data[0]?.id : null;
    return typeof found === 'string' ? found : null;
  }

  let customerId: string | null = null;
  const storedCustomerId = typeof billing.stripeCustomerId === 'string' ? billing.stripeCustomerId : undefined;
  if (storedCustomerId) {
    const ok = await verifyCustomer(storedCustomerId).catch((err) => {
      console.error('verifyCustomer failed:', err);
      return false;
    });
    if (ok) {
      customerId = storedCustomerId;
    }
  }

  if (!customerId) {
    const email = session.user?.email || '';
    const lookedUp = await findCustomerByEmail(email).catch((err) => {
      console.error('findCustomerByEmail failed:', err);
      return null;
    });
    if (lookedUp) {
      customerId = lookedUp;
      await setBilling(uid, { ...billing, stripeCustomerId: lookedUp });
      await setCustomerIndex(lookedUp, uid);
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: 'no_customer' }, { status: 400 });
  }

  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const returnUrl = process.env.BILLING_PORTAL_RETURN_URL || `${origin}/account`;

  const body = new URLSearchParams({ customer: customerId, return_url: returnUrl });
  const resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json().catch(() => ({} as any));
  if (!resp.ok || !data?.url) {
    return NextResponse.json({ error: data?.error?.message || 'portal_failed' }, { status: 500 });
  }
  return NextResponse.redirect(data.url as string, { status: 302 });
}

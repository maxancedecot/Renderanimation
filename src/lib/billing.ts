import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2, R2_BUCKET } from '@/lib/r2';

export type BillingRecord = {
  stripeCustomerId?: string;
  subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused';
  priceId?: string;
  productId?: string;
  subscriptionId?: string;
  videosTotal?: number;     // quota per period
  videosRemaining?: number; // remaining in current period
  includes4k?: boolean;
  currentPeriodEnd?: number; // epoch seconds
  lastUpdatedAt?: string;    // ISO
};

function key(userId: string) {
  return `billing/${userId}.json`;
}

export async function getBilling(userId: string): Promise<BillingRecord | null> {
  try { await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key(userId) })); } catch { return null; }
  const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key(userId) }));
  const body = await obj.Body?.transformToString();
  if (!body) return null;
  try { return JSON.parse(body) as BillingRecord; } catch { return null; }
}

export async function setBilling(userId: string, rec: BillingRecord): Promise<void> {
  const body = JSON.stringify({ ...rec, lastUpdatedAt: new Date().toISOString() }, null, 2);
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key(userId), Body: body, ContentType: 'application/json', CacheControl: 'no-cache' }));
}

// Simple reverse indices to map Stripe IDs to userId
function customerIndexKey(customerId: string) { return `billing/index/customer_${customerId}.json`; }
function subscriptionIndexKey(subId: string) { return `billing/index/sub_${subId}.json`; }

export async function setCustomerIndex(customerId: string, userId: string): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: customerIndexKey(customerId), Body: JSON.stringify({ userId }), ContentType: 'application/json', CacheControl: 'no-cache' }));
}

export async function setSubscriptionIndex(subId: string, userId: string): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: subscriptionIndexKey(subId), Body: JSON.stringify({ userId }), ContentType: 'application/json', CacheControl: 'no-cache' }));
}

export async function getUserIdByCustomer(customerId: string): Promise<string | null> {
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: customerIndexKey(customerId) }));
    const body = await obj.Body?.transformToString();
    if (!body) return null;
    const j = JSON.parse(body);
    return j?.userId || null;
  } catch { return null; }
}

export async function getUserIdBySubscription(subId: string): Promise<string | null> {
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: subscriptionIndexKey(subId) }));
    const body = await obj.Body?.transformToString();
    if (!body) return null;
    const j = JSON.parse(body);
    return j?.userId || null;
  } catch { return null; }
}

export function planForPrice(priceId: string): { videosTotal: number; includes4k: boolean } | null {
  const map: Record<string, { videosTotal: number; includes4k: boolean }> = {};
  const p = (id?: string | null, q = 0, k = false) => { if (id) map[id] = { videosTotal: q, includes4k: k }; };
  // support multiple env keys mapping to the same quotas
  p(process.env.STRIPE_PRICE_BASIC_MONTHLY, 5, false);
  p(process.env.STRIPE_PRICE_BASIC_YEARLY, 5, false);
  p(process.env.STRIPE_PRICE_PRO_MONTHLY, 10, true);
  p(process.env.STRIPE_PRICE_PRO_YEARLY, 10, true);
  p(process.env.STRIPE_PRICE_BUSINESS_MONTHLY, 20, true);
  p(process.env.STRIPE_PRICE_BUSINESS_YEARLY, 20, true);
  return map[priceId] || null;
}

export async function ensurePeriod(userId: string, rec: BillingRecord): Promise<BillingRecord> {
  const now = Math.floor(Date.now() / 1000);
  if (!rec.currentPeriodEnd || now <= rec.currentPeriodEnd) return rec;
  // Try refreshing from Stripe subscription if we can
  let newEnd = rec.currentPeriodEnd;
  let priceId = rec.priceId;
  let status = rec.subscriptionStatus;
  if (rec.subscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const sk = process.env.STRIPE_SECRET_KEY!;
      const resp = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(rec.subscriptionId)}`, {
        headers: { 'Authorization': `Bearer ${sk}` }
      });
      const sub: any = await resp.json().catch(() => ({}));
      if (resp.ok) {
        newEnd = sub?.current_period_end || newEnd;
        priceId = sub?.items?.data?.[0]?.price?.id || priceId;
        status = sub?.status || status;
      }
    } catch {}
  }
  const quotas = priceId ? planForPrice(priceId) : null;
  const videosTotal = quotas?.videosTotal ?? rec.videosTotal ?? 0;
  const includes4k = quotas?.includes4k ?? rec.includes4k ?? false;
  const mult = Number(process.env.BILLING_ROLLOVER_CAP_MULTIPLIER || '1');
  const cap = Math.max(videosTotal, Math.floor(videosTotal * mult));
  const accumulated = (rec.videosRemaining ?? videosTotal) + videosTotal;
  const rolled = Math.min(accumulated, cap);
  const updated: BillingRecord = {
    ...rec,
    subscriptionStatus: status,
    priceId,
    videosTotal,
    includes4k,
    videosRemaining: rolled,
    currentPeriodEnd: newEnd,
    lastUpdatedAt: new Date().toISOString()
  };
  await setBilling(userId, updated);
  return updated;
}

export async function decrementVideoCredit(userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rec = await getBilling(userId);
  if (!rec || !rec.subscriptionStatus || !['trialing', 'active', 'past_due'].includes(rec.subscriptionStatus)) {
    return { ok: false, reason: 'no_active_subscription' };
  }
  const state = await ensurePeriod(userId, rec);
  const remaining = state.videosRemaining ?? 0;
  if (remaining <= 0) return { ok: false, reason: 'quota_exceeded' };
  const updated: BillingRecord = { ...state, videosRemaining: remaining - 1 };
  await setBilling(userId, updated);
  return { ok: true };
}

export async function canConsumeVideo(userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rec = await getBilling(userId);
  if (!rec || !rec.subscriptionStatus || !['trialing', 'active', 'past_due'].includes(rec.subscriptionStatus)) {
    return { ok: false, reason: 'no_active_subscription' };
  }
  const state = await ensurePeriod(userId, rec);
  const remaining = state.videosRemaining ?? 0;
  if (remaining <= 0) return { ok: false, reason: 'quota_exceeded' };
  return { ok: true };
}

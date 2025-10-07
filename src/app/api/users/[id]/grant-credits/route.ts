export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { getBilling, setBilling, type BillingRecord } from "@/lib/billing";
import { findUserById } from "@/lib/users";

function isAdmin(email?: string | null): boolean {
  const allow = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length === 0) return !!email;
  return !!email && allow.includes(email.toLowerCase());
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ error: "missing_user" }, { status: 400 });
  }

  const target = await findUserById(userId);
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawAmount = body?.amount;
  const amount = Number(rawAmount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount_invalid" }, { status: 400 });
  }

  const billing = await getBilling(userId).catch(() => null);
  const videosRemaining = (billing?.videosRemaining ?? 0) + amount;

  const updated: BillingRecord = {
    ...billing,
    videosRemaining,
    subscriptionStatus: billing?.subscriptionStatus || "active",
  };

  if (typeof updated.videosTotal !== "number") {
    updated.videosTotal = billing?.videosTotal ?? 0;
  }
  if (typeof updated.includes4k === "undefined") {
    updated.includes4k = billing?.includes4k ?? false;
  }

  await setBilling(userId, updated);

  return NextResponse.json({ ok: true, videosRemaining });
}


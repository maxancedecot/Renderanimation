export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { getBilling, setBilling, type BillingRecord } from "@/lib/billing";
import { findUserById } from "@/lib/users";

function sessionIsAdmin(session: any): boolean {
  if (!session?.user) return false;
  const env = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const email = (session.user.email || "").toLowerCase();
  const flag = (session.user as any).isAdmin === true;
  if (env.length > 0) {
    return flag || (email ? env.includes(email) : false);
  }
  return flag;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!sessionIsAdmin(session)) {
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
    updated.includes4k = true;
  }

  await setBilling(userId, updated);

  return NextResponse.json({ ok: true, videosRemaining });
}

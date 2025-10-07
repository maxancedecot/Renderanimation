export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { listUsers, addUser, ensureDefaultAdmin } from "@/lib/users";
import { getBilling } from "@/lib/billing";

function isAdmin(email?: string | null): boolean {
  const allow = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length === 0) return !!email; // if no list provided, any logged-in user can manage
  return !!email && allow.includes(email.toLowerCase());
}

export async function GET() {
  await ensureDefaultAdmin();
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const users = await listUsers();
  const withBilling = await Promise.all(users.map(async (user) => {
    try {
      const billing = await getBilling(user.id);
      return {
        ...user,
        videosRemaining: billing?.videosRemaining ?? 0,
        subscriptionStatus: billing?.subscriptionStatus || null,
      };
    } catch {
      return {
        ...user,
        videosRemaining: 0,
        subscriptionStatus: null,
      };
    }
  }));
  return NextResponse.json({ users: withBilling });
}

export async function POST(req: NextRequest) {
  await ensureDefaultAdmin();
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const { email, password, name } = await req.json();
    const user = await addUser({ email, password, name });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "create failed" }, { status: 400 });
  }
}

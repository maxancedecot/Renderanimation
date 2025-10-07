export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { listUsers, addUser, ensureDefaultAdmin, getEnvAdminEmails } from "@/lib/users";
import { getBilling } from "@/lib/billing";

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

export async function GET() {
  await ensureDefaultAdmin();
  const session = await auth();
  if (!sessionIsAdmin(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const users = await listUsers();
  const envSet = new Set(getEnvAdminEmails());
  const withBilling = await Promise.all(users.map(async (user) => {
    try {
      const billing = await getBilling(user.id);
      return {
        ...user,
        videosRemaining: billing?.videosRemaining ?? 0,
        subscriptionStatus: billing?.subscriptionStatus || null,
        envAdmin: envSet.has(user.email.toLowerCase()),
      };
    } catch {
      return {
        ...user,
        videosRemaining: 0,
        subscriptionStatus: null,
        envAdmin: envSet.has(user.email.toLowerCase()),
      };
    }
  }));
  return NextResponse.json({ users: withBilling });
}

export async function POST(req: NextRequest) {
  await ensureDefaultAdmin();
  const session = await auth();
  if (!sessionIsAdmin(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const { email, password, name } = await req.json();
    const user = await addUser({ email, password, name, admin: false });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "create failed" }, { status: 400 });
  }
}

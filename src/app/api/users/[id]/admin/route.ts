export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { findUserById, setUserAdmin, findUserByEmail } from "@/lib/users";

async function sessionIsAdmin(session: any): Promise<boolean> {
  if (!session?.user) return false;
  const env = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const email = (session.user.email || "").toLowerCase();
  const flag = (session.user as any).isAdmin === true;
  if (env.length > 0) {
    if (email && env.includes(email)) return true;
  }
  if (flag) return true;
  if (!email) return false;
  try {
    const user = await findUserByEmail(email);
    return !!user?.admin;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!(await sessionIsAdmin(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const currentUser = session?.user;
  if (!currentUser) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const targetId = params.id;
  if (!targetId) {
    return NextResponse.json({ error: "missing_user" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof payload?.admin !== "boolean") {
    return NextResponse.json({ error: "invalid_admin_flag" }, { status: 400 });
  }

  const desired = payload.admin === true;
  const target = await findUserById(targetId);
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const currentId = (currentUser as any).id || (currentUser as any).uid || null;
  if (currentId && currentId === targetId && desired === false) {
    return NextResponse.json({ error: "cannot_demote_self" }, { status: 400 });
  }

  try {
    await setUserAdmin(targetId, desired);
  } catch (e: any) {
    const message = e?.message || 'admin_update_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, admin: desired });
}

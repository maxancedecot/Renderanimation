export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { findUserById, setUserAdmin } from "@/lib/users";

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

  await setUserAdmin(targetId, desired);

  return NextResponse.json({ ok: true, admin: desired });
}

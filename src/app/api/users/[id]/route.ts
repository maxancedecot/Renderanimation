export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { deleteUser } from "@/lib/users";

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!sessionIsAdmin(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const ok = await deleteUser(params.id);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "delete failed" }, { status: 400 });
  }
}

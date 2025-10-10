export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { deleteUser, findUserByEmail } from "@/lib/users";

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!(await sessionIsAdmin(session))) {
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

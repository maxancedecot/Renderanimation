export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { deleteFolder } from "@/lib/library";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  const uid = session?.user?.email;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ok = await deleteFolder(String(uid), params.id);
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}


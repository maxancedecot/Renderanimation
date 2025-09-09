export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { moveItemToFolder } from "@/lib/library";

export async function POST(req: NextRequest) {
  const session = await auth();
  const uid = session?.user?.email;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { itemId, folderId } = await req.json();
    if (!itemId || typeof itemId !== 'string') return NextResponse.json({ error: 'itemId requis' }, { status: 400 });
    const item = await moveItemToFolder(String(uid), itemId, typeof folderId === 'string' ? folderId : undefined);
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'move failed' }, { status: 400 });
  }
}


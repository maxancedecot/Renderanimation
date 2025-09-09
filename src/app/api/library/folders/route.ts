export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { listFolders, createFolder } from "@/lib/library";

export async function GET() {
  const session = await auth();
  const uid = session?.user?.email;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const folders = await listFolders(String(uid));
  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const uid = session?.user?.email;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { name } = await req.json();
    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'name requis' }, { status: 400 });
    const folder = await createFolder(String(uid), name);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'create failed' }, { status: 400 });
  }
}


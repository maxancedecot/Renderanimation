export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { topazGetStatus } from "@/lib/topaz";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId') || searchParams.get('id');
    if (!taskId) return NextResponse.json({ error: 'taskId manquant' }, { status: 400 });
    const st = await topazGetStatus(taskId);
    return NextResponse.json(st);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'status failed' }, { status: 400 });
  }
}


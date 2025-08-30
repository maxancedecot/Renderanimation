// src/app/api/topaz/status/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getTopazUpscaleStatus } from "@/lib/topaz";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "taskId manquant" }, { status: 400 });
    const st = await getTopazUpscaleStatus(taskId);
    return NextResponse.json({ status: st.status, message: st.message ?? null, videoUrl: st.videoUrl ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur Topaz" }, { status: 500 });
  }
}


// src/app/api/kling/status/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getImageToVideoStatus } from "@/lib/kling";

export async function GET(req: Request) {
  try {
    // Ensure URL parsing works even if req.url is relative in some runtimes
    const { searchParams } = new URL(req.url, "http://localhost");
    const taskId = searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ error: "taskId manquant" }, { status: 400 });
    }

    const st = await getImageToVideoStatus(taskId);
    return NextResponse.json({
      status: st.status,
      videoUrl: st.videoUrl ?? null,
      message: st.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}

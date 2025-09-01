export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { runwayGetStatus } from "@/lib/runway";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "taskId manquant" }, { status: 400 });

    const s = await runwayGetStatus(taskId);
    return NextResponse.json({ status: s.status, videoUrl: s.videoUrl ?? null, message: s.message ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}


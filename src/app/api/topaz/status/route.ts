// src/app/api/topaz/status/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getTopazUpscaleStatus } from "@/lib/topaz";

export async function GET(req: NextRequest) {
  try {
    const missing: string[] = [];
    if (!process.env.TOPAZ_API_KEY) missing.push("TOPAZ_API_KEY");
    if (!process.env.TOPAZ_STATUS_URL_TEMPLATE) missing.push("TOPAZ_STATUS_URL_TEMPLATE");
    if (missing.length) {
      return NextResponse.json({ error: `Topaz env manquantes: ${missing.join(", ")}` }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "taskId manquant" }, { status: 400 });
    const st = await getTopazUpscaleStatus(taskId);
    return NextResponse.json({ status: st.status, message: st.message ?? null, videoUrl: st.videoUrl ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur Topaz" }, { status: 500 });
  }
}

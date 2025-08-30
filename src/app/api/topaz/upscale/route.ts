// src/app/api/topaz/upscale/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createTopazUpscaleTask } from "@/lib/topaz";

export async function POST(req: NextRequest) {
  try {
    const missing: string[] = [];
    if (!process.env.TOPAZ_API_KEY) missing.push("TOPAZ_API_KEY");
    if (!process.env.TOPAZ_CREATE_URL) missing.push("TOPAZ_CREATE_URL");
    if (!process.env.TOPAZ_STATUS_URL_TEMPLATE) missing.push("TOPAZ_STATUS_URL_TEMPLATE");
    if (missing.length) {
      return NextResponse.json({ error: `Topaz env manquantes: ${missing.join(", ")}` }, { status: 500 });
    }
    const { videoUrl, topazBody } = await req.json();
    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json({ error: "videoUrl requis" }, { status: 400 });
    }
    const { taskId } = await createTopazUpscaleTask(videoUrl, topazBody && typeof topazBody === "object" ? topazBody : undefined);
    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur Topaz" }, { status: 500 });
  }
}

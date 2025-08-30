// src/app/api/topaz/upscale/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createTopazUpscaleTask } from "@/lib/topaz";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl } = await req.json();
    if (!videoUrl || typeof videoUrl !== "string") {
      return NextResponse.json({ error: "videoUrl requis" }, { status: 400 });
    }
    const { taskId } = await createTopazUpscaleTask(videoUrl);
    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur Topaz" }, { status: 500 });
  }
}


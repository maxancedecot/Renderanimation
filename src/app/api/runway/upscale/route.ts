export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { runwayUpscale4k } from "@/lib/runway";

export async function POST(req: Request) {
  try {
    const { input } = await req.json();
    if (!input || typeof input !== "string") return NextResponse.json({ error: "input requis (taskId ou URL)" }, { status: 400 });
    const { taskId } = await runwayUpscale4k(input);
    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}


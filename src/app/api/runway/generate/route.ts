export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { runwayCreateTask } from "@/lib/runway";

export async function POST(req: Request) {
  try {
    const missing: string[] = [];
    if (!process.env.RUNWAY_API_KEY) missing.push("RUNWAY_API_KEY");
    if (!process.env.RUNWAY_CREATE_PATH) missing.push("RUNWAY_CREATE_PATH");
    if (!process.env.RUNWAY_STATUS_PATH_TEMPLATE) missing.push("RUNWAY_STATUS_PATH_TEMPLATE");
    if (missing.length) return NextResponse.json({ error: `Runway env manquantes: ${missing.join(', ')}` }, { status: 500 });

    const { prompt, imageUrl, imageDataUrl, durationSec } = await req.json();
    if (!prompt || typeof prompt !== "string") return NextResponse.json({ error: "prompt manquant" }, { status: 400 });
    const dur = Number(durationSec ?? 5);
    if (![5, 10].includes(dur)) return NextResponse.json({ error: "durationSec invalide (5 ou 10)" }, { status: 400 });

    const { taskId, raw } = await runwayCreateTask({ prompt, imageUrl, imageDataUrl, durationSec: dur });
    return NextResponse.json({ taskId, raw });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}

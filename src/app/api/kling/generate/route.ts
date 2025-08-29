// src/app/api/kling/generate/route.ts
import { NextResponse } from "next/server";
import { createImageToVideoTask } from "@/lib/kling";

export async function POST(req: Request) {
  try {
    const { prompt, imageUrl, imageDataUrl, durationSec } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt manquant" }, { status: 400 });
    }
    const dur = Number(durationSec ?? 5);
    if (![5, 10].includes(dur)) {
      return NextResponse.json({ error: "durationSec invalide (5 ou 10)" }, { status: 400 });
    }

    const { taskId } = await createImageToVideoTask({
      prompt,
      imageUrl,
      imageDataUrl,
      durationSec: dur,
      mode: "pro",
      cfgScale: 0.5,
    });

    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}
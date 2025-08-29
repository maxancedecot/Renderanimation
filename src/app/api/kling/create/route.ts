// src/app/api/kling/create/route.ts
// NOTE: garde cette route seulement si ton front l'appelle encore.
// Sinon, tu peux simplement la supprimer.

import { NextResponse, NextRequest } from "next/server";
import { createImageToVideoTask } from "@/lib/kling"; // ✅ nouvelle lib
// ⛔️ ne plus importer generateKlingToken / mauvais alias @/src
// import { generateKlingToken } from "@/src/lib/klingAuth";

export async function POST(req: NextRequest) {
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
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const RUNWAY_BASE = "https://api.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "RUNWAY_API_KEY manquante" }, { status: 500 });

    const { imageUrl, prompt, duration, orientation, model } = await req.json();
    if (!imageUrl || !prompt) return NextResponse.json({ error: "imageUrl et prompt requis" }, { status: 400 });

    const body = {
      imageUrl,
      prompt,
      duration,
      orientation,
      model: model || "gen4_turbo",
    };

    const res = await fetch(`${RUNWAY_BASE}/v1/image_to_video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_VERSION,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || `HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const taskId = data?.id || data?.task_id || data?.data?.id;
    if (!taskId) return NextResponse.json({ error: "taskId introuvable" }, { status: 500 });
    return NextResponse.json({ taskId: String(taskId) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}


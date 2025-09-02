export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const RUNWAY_BASE = "https://api.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "RUNWAY_API_KEY manquante" }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || searchParams.get("taskId");
    if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

    const url = `${RUNWAY_BASE}/v1/tasks/${encodeURIComponent(id)}`;
    console.log("[runway/status] id:", id, "endpoint:", url);
    const res = await fetch(url , {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_VERSION,
        Accept: "application/json",
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || `HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const rawStatus = (data?.status || data?.state || "pending").toString().toLowerCase();
    const status = ["pending","running","succeeded","failed"].includes(rawStatus)
      ? rawStatus
      : (rawStatus.includes("success") ? "succeeded" : (rawStatus.includes("fail") ? "failed" : rawStatus));
    const videoUrl = data?.result?.url || data?.video_url || data?.outputs?.[0]?.url || null;
    return NextResponse.json({ status, videoUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}

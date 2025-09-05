export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { addCreation, listCreations } from "@/lib/library";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await listCreations(session.user.id as string);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { provider, prompt, imageUrl, videoUrl, durationSec, project, tags } = await req.json();
    if (!videoUrl) return NextResponse.json({ error: "videoUrl manquant" }, { status: 400 });
    if (provider !== "kling" && provider !== "runway") return NextResponse.json({ error: "provider invalide" }, { status: 400 });
    const rec = await addCreation(session.user.id as string, {
      provider,
      prompt,
      imageUrl,
      videoUrl,
      durationSec: durationSec ? Number(durationSec) : undefined,
      project: typeof project === "string" ? project : undefined,
      tags: Array.isArray(tags) ? tags.filter((t: any) => typeof t === "string" && t.trim().length).map((t: string) => t.trim()) : undefined,
    });
    return NextResponse.json({ item: rec });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}


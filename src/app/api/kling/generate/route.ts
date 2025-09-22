// src/app/api/kling/generate/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createImageToVideoTask } from "@/lib/kling";
import fs from "node:fs";
import path from "node:path";
import { auth } from "@/src/lib/auth";
import { canConsumeVideo } from "@/lib/billing";

function guessMimeFromExt(p: string) {
  const ext = p.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  return "image/png";
}

export async function POST(req: Request) {
  try {
    // Enforce subscription credits per user
    const session = await auth();
    const uid = session?.user ? (String((session.user as any).id || '')) : undefined;
    if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { prompt, imageUrl, imageDataUrl, durationSec } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt manquant" }, { status: 400 });
    }
    const dur = Number(durationSec ?? 5);
    if (![5, 10].includes(dur)) {
      return NextResponse.json({ error: "durationSec invalide (5 ou 10)" }, { status: 400 });
    }

    // Auto-convert relative public path to base64 if needed (e.g. /uploads/abc.png)
    let finalImageDataUrl = imageDataUrl as string | undefined;
    if (!finalImageDataUrl && typeof imageUrl === "string" && imageUrl.startsWith("/")) {
      const rel = imageUrl.replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", rel);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: `fichier introuvable: ${imageUrl}` }, { status: 404 });
      }
      const buf = fs.readFileSync(filePath);
      const b64 = buf.toString("base64");
      const mime = guessMimeFromExt(filePath);
      finalImageDataUrl = `data:${mime};base64,${b64}`;
    }

    // Check quota before sending the job; decrement will happen on successful save
    const chk = await canConsumeVideo(uid);
    if (!chk.ok) {
      const msg = chk.reason === 'no_active_subscription' ? 'subscription_required' : 'quota_exceeded';
      return NextResponse.json({ error: msg }, { status: 402 });
    }

    const { taskId } = await createImageToVideoTask({
      prompt,
      imageUrl,
      imageDataUrl: finalImageDataUrl,
      durationSec: dur,
      mode: "pro",
      cfgScale: 0.5,
    });

    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status: 500 });
  }
}

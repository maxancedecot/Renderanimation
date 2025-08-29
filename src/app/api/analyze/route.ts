export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { analyzeImageFromUrl, analyzeImageFromBase64 } from "@/src/lib/openaiVision";
import { createPromptFromAnalysis } from "@/src/lib/klingPrompt";
import fs from "node:fs";
import path from "node:path";

function guessMimeFromExt(p: string) {
  const ext = p.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl requis" }, { status: 400 });

    let analysis;

    if (imageUrl.startsWith("/uploads/")) {
      // Image stockée en local : on lit le fichier et on envoie en base64 à OpenAI
      const filePath = path.join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
      if (!fs.existsSync(filePath)) {
  return NextResponse.json({ error: "fichier introuvable" }, { status: 404 });
}
      const buf = fs.readFileSync(filePath);
      const b64 = buf.toString("base64");
      const mime = guessMimeFromExt(filePath);
      analysis = await analyzeImageFromBase64(b64, mime);
    } else {
      // URL publique accessible par OpenAI
      analysis = await analyzeImageFromUrl(imageUrl);
    }

    const prompt = createPromptFromAnalysis(analysis, { durationSec: 7, fps: 24, aspect: "16:9" });
    return NextResponse.json({ analysis, prompt });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "analyse failed" }, { status: 500 });
  }
}

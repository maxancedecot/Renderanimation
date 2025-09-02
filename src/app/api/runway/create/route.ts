export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { r2, R2_BUCKET } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const RUNWAY_BASE = (process.env.RUNWAY_API_BASE || "https://api.runwayml.com").replace(/\/+$/, "");
const RUNWAY_VERSION = "2024-11-06";

function isHttpUrl(x: string) {
  try { const u = new URL(x); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

function extractBase64(dataUrl: string) {
  const i = dataUrl.indexOf("base64,");
  if (i === -1) throw new Error("dataURL invalide (pas de base64,)");
  return dataUrl.slice(i + "base64,".length);
}

async function uploadToR2Public(buffer: Buffer, contentType = "image/png") {
  const key = `runway/${randomUUID()}.png`;
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  const publicBase =
    process.env.CDN_BASE?.replace(/\/$/, "") ||
    `https://${process.env.S3_ENDPOINT?.replace(/^https?:\/\//, "")}/${R2_BUCKET}`;
  return `${publicBase}/${key}`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "RUNWAY_API_KEY manquante" }, { status: 500 });

    const { imageUrl, prompt, duration, orientation, model, promptImage } = await req.json();
    let finalPromptImage: any = undefined;
    if (promptImage) {
      finalPromptImage = promptImage;
    } else if (typeof imageUrl === "string" && imageUrl.length > 0) {
      if (imageUrl.startsWith("data:")) {
        const b64 = extractBase64(imageUrl);
        const buf = Buffer.from(b64, "base64");
        finalPromptImage = await uploadToR2Public(buf, "image/png");
      } else if (isHttpUrl(imageUrl)) {
        finalPromptImage = imageUrl;
      }
    }
    if (!finalPromptImage) {
      return NextResponse.json({ error: "promptImage requis (URL https publique)" }, { status: 400 });
    }

    const ratio = (orientation === "portrait") ? "768:1280" : "1280:768";
    const outgoing: Record<string, any> = {
      model: model || "gen4_turbo",
      promptText: typeof prompt === "string" ? prompt : "Animate this still image into a subtle, smooth motion.",
      promptImage: finalPromptImage,
      duration: Number(duration ?? 5),
      ratio,
    };

    const res = await fetch(`${RUNWAY_BASE}/v1/image_to_video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_VERSION,
        Accept: "application/json",
      },
      body: JSON.stringify(outgoing),
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


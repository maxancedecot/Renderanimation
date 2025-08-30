// src/app/api/topaz/upscale/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v.trim();
}

function normalizeAbsoluteUrl(raw: string) {
  let u = raw.trim();
  u = u.replace(/^https:\s+\/\//i, "https://");
  if (u.startsWith("//")) u = "https:" + u;
  new URL(u); // throw si invalide
  return u;
}

// HEAD pour récupérer la taille du fichier (Content-Length)
async function getContentLength(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    if (!r.ok) return null;
    const len = r.headers.get("content-length");
    if (!len) return null;
    const n = Number(len);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Body attendu (JSON)
 * {
 *   "sourceUrl": "https://.../video.mp4",   // requis (accessible publiquement)
 *   "width": 1920,                          // requis (si inconnu, récupère via tes métadonnées)
 *   "height": 1080,                         // requ
 *   "fps": 24,                              // requis
 *   "duration": 7,                          // requis (secondes)
 *   "container": "mp4",                     // optionnel (par défaut "mp4")
 *   "videoCodec": "h264",                   // optionnel
 *   "audioCodec": "aac",                    // optionnel
 *   "audioTransfer": "Copy",                // "Copy" | "Convert" | "None" (requis par Topaz)
 *   "scale": 2,                             // optionnel (2, 4, etc.)
 *   "model": "auto",                        // optionnel
 *   "outWidth": 3840,                       // optionnel (sinon width*scale)
 *   "outHeight": 2160,                      // optionnel (sinon height*scale)
 *   "videoBitrate": "10m"                   // optionnel, sinon "10m"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const KEY = must("TOPAZ_API_KEY");
    const CREATE_RAW = must("TOPAZ_CREATE_URL");
    const CREATE = normalizeAbsoluteUrl(CREATE_RAW);

    const body = await req.json().catch(() => ({}));
    const {
      sourceUrl,
      width,
      height,
      fps,
      duration,
      container = "mp4",
      videoCodec = "h264",
      audioCodec = "aac",
      audioTransfer = "Copy",
      scale = 2,
      model = "auto",
      outWidth,
      outHeight,
      videoBitrate = "10m",
      size // facultatif : si absent, on tente HEAD
    } = body || {};

    // validations utiles
    if (!sourceUrl || typeof sourceUrl !== "string") {
      return NextResponse.json({ error: "sourceUrl requis (URL publique vidéo)" }, { status: 400 });
    }
    if (
      !Number.isFinite(width) || !Number.isFinite(height) ||
      !Number.isFinite(fps) || !Number.isFinite(duration)
    ) {
      return NextResponse.json(
        { error: "width, height, fps, duration sont requis et numériques" },
        { status: 400 }
      );
    }
    if (!["Copy", "Convert", "None"].includes(String(audioTransfer))) {
      return NextResponse.json(
        { error: "audioTransfer doit être 'Copy' | 'Convert' | 'None'" },
        { status: 400 }
      );
    }

    const frameCount = Math.round(Number(fps) * Number(duration));

    // taille du fichier
    let fileSize = Number(size);
    if (!Number.isFinite(fileSize)) {
      fileSize = (await getContentLength(sourceUrl)) ?? 0;
      if (!fileSize) {
        return NextResponse.json(
          { error: "Impossible de déterminer la taille du fichier (size). Passe 'size' dans le body ou assure-toi que HEAD retourne Content-Length." },
          { status: 400 }
        );
      }
    }

    const oWidth = Number.isFinite(outWidth) ? Number(outWidth) : Math.round(Number(width) * Number(scale));
    const oHeight = Number.isFinite(outHeight) ? Number(outHeight) : Math.round(Number(height) * Number(scale));

    const payload = {
      source: {
        url: sourceUrl,
        container,
        size: fileSize,
        duration: Number(duration),
        frameCount,
        frameRate: Number(fps),
        resolution: { width: Number(width), height: Number(height) }
      },
      filters: [
        { type: "upscale", scale: Number(scale), model: String(model) }
      ],
      output: {
        container,
        videoCodec,
        resolution: { width: oWidth, height: oHeight },
        frameRate: Number(fps),
        audioTransfer: String(audioTransfer),
        audioCodec,
        videoBitrate
      }
    };

    const resp = await fetch(CREATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": KEY
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    let data: any; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    if (!resp.ok) {
      return NextResponse.json(
        {
          error: `Topaz create error: ${data?.message || resp.statusText || "Unknown"}`,
          status: resp.status,
          details: data,
          debug: { sentPayload: payload }
        },
        { status: 502 }
      );
    }

    const requestId = data?.requestId || data?.id || data?.taskId || data?.data?.requestId;
    if (!requestId) {
      return NextResponse.json(
        { error: "Réponse Topaz sans requestId", details: data },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, requestId, raw: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}
// src/app/api/images/remove-people/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { r2, R2_BUCKET } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import fs from "node:fs";
import path from "node:path";

function guessMimeFromExt(p: string) {
  const ext = p.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  return "image/png";
}

type ImagePayload = { data: Uint8Array; contentType: string };

function fallbackContentType(ext?: string | null): string {
  if (!ext) return "image/png";
  const lower = ext.toLowerCase();
  if (lower === "png") return "image/png";
  if (lower === "webp") return "image/webp";
  if (lower === "jpg" || lower === "jpeg") return "image/jpeg";
  if (lower === "tif" || lower === "tiff") return "image/tiff";
  return "image/png";
}

async function fetchImageBuffer(imageUrlOrDataUrl: string): Promise<ImagePayload> {
  if (imageUrlOrDataUrl.startsWith("data:")) {
    const match = imageUrlOrDataUrl.match(/^data:([^;]+);base64,/i);
    if (!match) throw new Error("dataURL invalide (pas de base64)");
    const mime = match[1] || "image/png";
    const b64 = imageUrlOrDataUrl.slice(match[0].length);
    return { data: Uint8Array.from(Buffer.from(b64, "base64")), contentType: mime };
  }
  // Support relative public path like /uploads/...
  if (imageUrlOrDataUrl.startsWith("/")) {
    const rel = imageUrlOrDataUrl.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", rel);
    if (!fs.existsSync(filePath)) throw new Error(`fichier introuvable: ${imageUrlOrDataUrl}`);
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace(/^\./, "");
    return { data: new Uint8Array(buf), contentType: fallbackContentType(ext) };
  }
  const res = await fetch(imageUrlOrDataUrl);
  if (!res.ok) throw new Error(`Téléchargement image échoué: ${res.status} ${res.statusText}`);
  const array = new Uint8Array(await res.arrayBuffer());
  const headerType = res.headers.get("content-type") || undefined;
  if (headerType && /^image\//i.test(headerType)) {
    return { data: array, contentType: headerType.toLowerCase() };
  }
  const urlExt = (() => {
    try {
      const u = new URL(imageUrlOrDataUrl);
      return u.pathname.split(".").pop();
    } catch {
      return null;
    }
  })();
  return { data: array, contentType: fallbackContentType(urlExt) };
}

export async function POST(req: Request) {
  try {
    const { imageUrl, imageDataUrl } = await req.json();

    const src = imageDataUrl || imageUrl;
    if (!src) {
      return NextResponse.json({ error: "imageUrl ou imageDataUrl requis" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY manquante" }, { status: 500 });
    }

    const { data: buf, contentType } = await fetchImageBuffer(src);

    // OpenAI Images Edit (gpt-image-1) — pas de response_format avec la v4
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const ext = (() => {
      if (contentType.includes("png")) return "png";
      if (contentType.includes("webp")) return "webp";
      if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
      if (contentType.includes("tiff")) return "tiff";
      return "png";
    })();
    const file = await toFile(Buffer.from(buf), `input.${ext}`, { type: contentType });

    const prompt =
      "Remove all people from the image. Preserve architecture, furniture, materials, lighting and straight lines. Fill removed regions plausibly with consistent textures and shadows. No new people or objects.";

    const edit = await openai.images.edit({
      model: "gpt-image-1",
      image: file,            // une seule image (Uploadable)
      // mask: ... (optionnel, si tu veux un inpainting ciblé plus tard)
      prompt,
      n: 1,
      size: "1024x1024",      // stable; on pourra gérer le ratio original plus tard
    });

    const b64 = edit.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "Aucune image retournée par OpenAI" }, { status: 500 });
    }
    const outBuffer = Buffer.from(b64, "base64");

    const key = `clean/${randomUUID()}.png`;
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: outBuffer,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const publicBase =
      process.env.CDN_BASE?.replace(/\/$/, "") ||
      `https://${process.env.S3_ENDPOINT?.replace(/^https?:\/\//, "")}/${R2_BUCKET}`;
    const cleanedUrl = `${publicBase}/${key}`;

    return NextResponse.json({ cleanedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erreur suppression personnes" }, { status: 500 });
  }
}

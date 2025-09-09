// src/app/api/uploads/sign/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * ENV attendues (à mettre sur Vercel) :
 *  - S3_BUCKET                ex: renderanimation-uploads
 *  - S3_REGION                ex: auto   (R2 accepte "auto")
 *  - S3_ENDPOINT              ex: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *  - S3_ACCESS_KEY_ID         (R2 Access Key ID)
 *  - S3_SECRET_ACCESS_KEY     (R2 Secret Access Key)
 *  - CDN_BASE (optionnel)     ex: https://cdn.tondomaine.com  OU  https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>
 */

// Helpers
function iso8601(date = new Date()) {
  // YYYYMMDD'T'HHMMSS'Z' (sans : ni -)
  return date.toISOString().replace(/[:\-]|\.\d{3}/g, "");
}
function hmac(key: Buffer | string, msg: string) {
  return crypto.createHmac("sha256", key).update(msg).digest();
}
function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function encodeRFC3986(str: string) {
  return encodeURIComponent(str).replace(/[!'()*]/g, ch =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function normalizeBase(urlOrHost: string, { requireProtocol = true } = {}): string {
  const raw = (urlOrHost || "").trim();
  if (!raw) return raw;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    const noSlash = `${u.protocol}//${u.host}${u.pathname}`.replace(/\/+$/, "");
    return noSlash;
  } catch {
    if (requireProtocol) throw new Error(`URL invalide: ${urlOrHost}`);
    return raw;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();

    const bucket = process.env.S3_BUCKET!;
    const region = process.env.S3_REGION || "auto";
    const endpoint = process.env.S3_ENDPOINT!;
    const accessKey = process.env.S3_ACCESS_KEY_ID!;
    const secretKey = process.env.S3_SECRET_ACCESS_KEY!;
    if (!bucket || !endpoint || !accessKey || !secretKey) {
      return NextResponse.json(
        { error: "Config R2 incomplète (S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)" },
        { status: 500 }
      );
    }

    // Clé objet (chemin dans le bucket)
    const key = `uploads/${Date.now()}-${filename}`.replace(/\s+/g, "_");

    // Host (sans protocole ni slash final), validé
    const endpointBase = normalizeBase(endpoint);
    const host = endpointBase.replace(/^https?:\/\//, "");

    // Paramètres de signature SigV4
    const method = "PUT";
    const service = "s3";
    const amzDate = iso8601();        // ex: 20250829T101530Z
    const dateStamp = amzDate.slice(0, 8); // ex: 20250829
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const signedHeaders = "host";
    const expires = 300; // secondes (5 minutes)

    // Canonical URI (style R2 path: /<bucket>/<key>)
    const canonicalUri = `/${bucket}/${key}`;

    // Canonical Query String (ordre lexical)
    const q: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${accessKey}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expires),
      "X-Amz-SignedHeaders": signedHeaders
    };
    const canonicalQuery = Object.keys(q)
      .sort()
      .map(k => `${encodeRFC3986(k)}=${encodeRFC3986(q[k])}`)
      .join("&");

    // Canonical Headers + payload hash
    const canonicalHeaders = `host:${host}\n`;
    const payloadHash = "UNSIGNED-PAYLOAD"; // pour presigned URL

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join("\n");

    // Clé de signature
    const kDate = hmac(`AWS4${secretKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, "aws4_request");

    const signature = crypto
      .createHmac("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");

    // URL de PUT signée
    const uploadUrl = `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

    // URL publique de lecture (pour Kling)
    const rawCdnBase = process.env.CDN_BASE && process.env.CDN_BASE.trim().length > 0
      ? process.env.CDN_BASE
      : `https://${host}/${bucket}`;
    const cdnBase = normalizeBase(rawCdnBase);
    const publicUrl = `${cdnBase}/${key}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      // facultatif: renvoyer le type conseillé pour le PUT
      headers: { "Content-Type": contentType || "application/octet-stream" }
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "sign failed" },
      { status: 500 }
    );
  }
}

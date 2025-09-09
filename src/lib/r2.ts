// src/lib/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  forcePathStyle: true,
  region: "auto",
  endpoint: process.env.S3_ENDPOINT, // ex: https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

export const R2_BUCKET = process.env.S3_BUCKET!;
export const CDN_BASE = process.env.CDN_BASE || "";
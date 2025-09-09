// src/lib/library.ts
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/lib/r2";
import { randomUUID } from "node:crypto";

export type LibraryItem = {
  id: string;
  userId: string;
  title?: string;
  project?: string;
  tags?: string[];
  videoUrl: string; // public URL
  posterUrl?: string; // optional fallback image (initial uploaded photo)
  createdAt: string; // ISO
};

function indexKey(userId: string) {
  return `library/${userId}.json`;
}

function videosPrefix(userId: string) {
  return `videos/${userId}/`;
}

function guessContentTypeByUrl(url: string): string {
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  return 'video/mp4';
}

function publicBase(): string {
  const cdn = process.env.CDN_BASE?.replace(/\/$/, "");
  if (cdn) return cdn;
  const endpoint = process.env.S3_ENDPOINT?.replace(/^https?:\/\//, "");
  if (!endpoint) throw new Error("S3_ENDPOINT manquant pour construire l'URL publique");
  return `https://${endpoint}/${R2_BUCKET}`;
}

function toPublicUrl(key: string): string {
  return `${publicBase()}/${key}`;
}

async function readIndex(userId: string): Promise<LibraryItem[]> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: indexKey(userId) }));
  } catch {
    return [];
  }
  const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: indexKey(userId) }));
  const body = await obj.Body?.transformToString();
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? (parsed as LibraryItem[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(userId: string, items: LibraryItem[]): Promise<void> {
  const body = JSON.stringify(items, null, 2);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: indexKey(userId),
    Body: body,
    ContentType: 'application/json',
    CacheControl: 'no-cache',
  }));
}

export async function listLibrary(userId: string): Promise<LibraryItem[]> {
  const items = await readIndex(userId);
  // newest first
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function saveVideoFromUrl(userId: string, sourceUrl: string, meta?: { title?: string; project?: string; tags?: string[]; posterUrl?: string }): Promise<LibraryItem> {
  // Download source
  const res = await fetch(sourceUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Téléchargement vidéo échoué: ${res.status} ${res.statusText}`);
  }
  const id = randomUUID();
  const ext = sourceUrl.split('?')[0].toLowerCase().split('.').pop() || 'mp4';
  const key = `${videosPrefix(userId)}${id}.${ext}`;
  const contentType = guessContentTypeByUrl(sourceUrl);

  // Stream upload to R2
  const body = Buffer.from(await res.arrayBuffer());
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  const item: LibraryItem = {
    id,
    userId,
    title: meta?.title,
    project: meta?.project,
    tags: meta?.tags,
    videoUrl: toPublicUrl(key),
    posterUrl: meta?.posterUrl,
    createdAt: new Date().toISOString(),
  };
  const items = await readIndex(userId);
  items.push(item);
  await writeIndex(userId, items);
  return item;
}

export async function deleteLibraryItem(userId: string, id: string): Promise<boolean> {
  const items = await readIndex(userId);
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  // Try deleting the underlying object by parsing key from URL
  try {
    const url = new URL(items[idx].videoUrl);
    // key is path after bucket name
    const parts = url.pathname.replace(/^\//, '').split('/');
    // if URL includes bucket in path, parts[0] is bucket
    const maybeBucket = parts[0];
    const keyParts = maybeBucket === R2_BUCKET ? parts.slice(1) : parts;
    const key = keyParts.join('/');
    if (key) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    }
  } catch {
    // ignore
  }
  items.splice(idx, 1);
  await writeIndex(userId, items);
  return true;
}

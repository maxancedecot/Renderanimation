// src/lib/library.ts
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { r2, R2_BUCKET } from "@/lib/r2";

export type CreationRecord = {
  id: string;
  userId: string;
  createdAt: string; // ISO
  provider: "kling" | "runway";
  prompt?: string;
  imageUrl?: string | null;
  videoUrl: string;
  durationSec?: number;
  project?: string;
  tags?: string[];
};

function keyFor(userId: string) {
  return `users/library/${userId}.json`;
}

async function readAll(userId: string): Promise<CreationRecord[]> {
  const Key = keyFor(userId);
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key }));
  } catch {
    return [];
  }
  const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key }));
  const body = await obj.Body?.transformToString();
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? (parsed as CreationRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(userId: string, items: CreationRecord[]): Promise<void> {
  const Key = keyFor(userId);
  const Body = JSON.stringify(items, null, 2);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key,
    Body,
    ContentType: "application/json",
    CacheControl: "no-cache",
  }));
}

export async function listCreations(userId: string): Promise<CreationRecord[]> {
  return readAll(userId);
}

export async function addCreation(userId: string, input: Omit<CreationRecord, "id" | "userId" | "createdAt">): Promise<CreationRecord> {
  if (!input?.videoUrl) throw new Error("videoUrl requis");
  const now = new Date().toISOString();
  const rec: CreationRecord = {
    id: randomUUID(),
    userId,
    createdAt: now,
    provider: input.provider,
    prompt: input.prompt,
    imageUrl: input.imageUrl ?? null,
    videoUrl: input.videoUrl,
    durationSec: input.durationSec,
    project: input.project,
    tags: input.tags,
  };
  const items = await readAll(userId);
  items.unshift(rec);
  await writeAll(userId, items);
  return rec;
}

export async function removeCreation(userId: string, creationId: string): Promise<boolean> {
  const items = await readAll(userId);
  const idx = items.findIndex((x) => x.id === creationId);
  if (idx === -1) return false;
  items.splice(idx, 1);
  await writeAll(userId, items);
  return true;
}

export async function updateCreation(
  userId: string,
  creationId: string,
  patch: Partial<Pick<CreationRecord, "project" | "tags">>
): Promise<CreationRecord | null> {
  const items = await readAll(userId);
  const idx = items.findIndex((x) => x.id === creationId);
  if (idx === -1) return null;
  const cur = items[idx];
  const next: CreationRecord = {
    ...cur,
    project: patch.project !== undefined ? patch.project : cur.project,
    tags: patch.tags !== undefined ? patch.tags : cur.tags,
  };
  items[idx] = next;
  await writeAll(userId, items);
  return next;
}


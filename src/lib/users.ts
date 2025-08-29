// src/lib/users.ts
// Simple users store backed by Cloudflare R2 (JSON file)
// Passwords are hashed using Node crypto scrypt

import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { r2, R2_BUCKET } from "@/lib/r2";

export type UserRecord = {
  id: string;
  email: string;
  name?: string;
  passwordHash: string; // format: scrypt:<saltHex>:<keyHex>
  createdAt: string; // ISO
};

const USERS_KEY = "users/users.json";

async function readAll(): Promise<UserRecord[]> {
  try {
    // Check if exists first to avoid noisy errors
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: USERS_KEY }));
  } catch {
    return [];
  }
  const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: USERS_KEY }));
  const body = await obj.Body?.transformToString();
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? (parsed as UserRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(users: UserRecord[]): Promise<void> {
  const body = JSON.stringify(users, null, 2);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: USERS_KEY,
    Body: body,
    ContentType: "application/json",
    CacheControl: "no-cache",
  }));
}

export async function listUsers(): Promise<Omit<UserRecord, "passwordHash">[]> {
  const users = await readAll();
  return users.map(({ passwordHash, ...u }) => u);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(key).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, keyHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !keyHex) return false;
  const key = Buffer.from(keyHex, "hex");
  const calc = scryptSync(password, salt, key.length);
  return timingSafeEqual(key, calc);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const users = await readAll();
  const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  return u || null;
}

export async function addUser(params: { email: string; password: string; name?: string }): Promise<Omit<UserRecord, "passwordHash">> {
  const email = params.email.trim().toLowerCase();
  const name = params.name?.trim();
  if (!email || !params.password) throw new Error("email et password requis");
  const users = await readAll();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error("Utilisateur déjà existant");
  }
  const user: UserRecord = {
    id: crypto.randomUUID(),
    email,
    name,
    passwordHash: hashPassword(params.password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeAll(users);
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function deleteUser(id: string): Promise<boolean> {
  const users = await readAll();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  users.splice(idx, 1);
  await writeAll(users);
  return true;
}

/** Ensure a default admin exists from env DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD */
export async function ensureDefaultAdmin(): Promise<void> {
  const email = (process.env.DEFAULT_ADMIN_EMAIL || "").trim();
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "";
  if (!email || !password) return;
  const users = await readAll();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return;
  const user: UserRecord = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name: "Admin",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeAll(users);
}

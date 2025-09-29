// src/lib/users.ts
// Simple users store backed by Cloudflare R2 (JSON file)
// Passwords are hashed using Node crypto scrypt

import { GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import { r2, R2_BUCKET } from "@/lib/r2";

export type UserRecord = {
  id: string;
  email: string;
  name?: string;
  passwordHash: string; // format: scrypt:<saltHex>:<keyHex>
  createdAt: string; // ISO
  verified?: boolean; // email verified flag
};

const USERS_KEY = "users/users.json";
const RESET_PREFIX = "users/reset/"; // tokens stored as users/reset/<token>.json
const VERIFY_PREFIX = "users/verify/"; // tokens stored as users/verify/<token>.json

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
    id: randomUUID(),
    email,
    name,
    passwordHash: hashPassword(params.password),
    createdAt: new Date().toISOString(),
    verified: false,
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
    id: randomUUID(),
    email: email.toLowerCase(),
    name: "Admin",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    verified: true,
  };
  users.push(user);
  await writeAll(users);
}

export async function updateUserPassword(id: string, newPassword: string): Promise<boolean> {
  const users = await readAll();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  users[idx].passwordHash = hashPassword(newPassword);
  await writeAll(users);
  return true;
}

type ResetRecord = { userId: string; email: string; exp: number };

export async function createPasswordResetToken(userId: string, email: string, ttlSeconds = 3600): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const rec: ResetRecord = { userId, email, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: `${RESET_PREFIX}${token}.json`,
    Body: JSON.stringify(rec),
    ContentType: "application/json",
    CacheControl: "no-cache",
  }));
  return token;
}

export async function getPasswordResetRecord(token: string): Promise<ResetRecord | null> {
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: `${RESET_PREFIX}${token}.json` }));
    const body = await obj.Body?.transformToString();
    if (!body) return null;
    const rec = JSON.parse(body) as ResetRecord;
    return rec || null;
  } catch {
    return null;
  }
}

export async function consumePasswordResetToken(token: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: `${RESET_PREFIX}${token}.json` }));
  } catch {
    // ignore
  }
}

// Email verification tokens
export async function createEmailVerificationToken(userId: string, email: string, ttlSeconds = 7 * 24 * 3600): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const rec: ResetRecord = { userId, email, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: `${VERIFY_PREFIX}${token}.json`,
    Body: JSON.stringify(rec),
    ContentType: "application/json",
    CacheControl: "no-cache",
  }));
  return token;
}

export async function getEmailVerificationRecord(token: string): Promise<ResetRecord | null> {
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: `${VERIFY_PREFIX}${token}.json` }));
    const body = await obj.Body?.transformToString();
    if (!body) return null;
    const rec = JSON.parse(body) as ResetRecord;
    return rec || null;
  } catch {
    return null;
  }
}

export async function consumeEmailVerificationToken(token: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: `${VERIFY_PREFIX}${token}.json` }));
  } catch {}
}

export async function markUserVerified(id: string): Promise<boolean> {
  const users = await readAll();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  users[idx].verified = true;
  await writeAll(users);
  return true;
}

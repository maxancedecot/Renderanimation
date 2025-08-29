import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { randomUUID } from "crypto";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

// Ce endpoint reçoit un fichier en base64 pour simplifier le MVP local
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { filename, base64, mime } = await req.json();
  if (!base64) return NextResponse.json({ error: "missing base64" }, { status: 400 });

  const buf = Buffer.from(base64, "base64");
  const id = randomUUID();
  const dir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const ext = filename?.split(".").pop() || "png";
  const filePath = path.join(dir, `${id}.${ext}`);
  fs.writeFileSync(filePath, buf);
  const publicUrl = `/uploads/${id}.${ext}`;
  return NextResponse.json({ url: publicUrl, mime: mime || "image/png" });
}

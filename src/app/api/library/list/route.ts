export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { listLibrary } from "@/lib/library";

export async function GET() {
  const session = await auth();
  const uid = session?.user?.email;
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const items = await listLibrary(String(uid));
  return NextResponse.json({ items });
}

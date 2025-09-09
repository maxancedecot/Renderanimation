export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { topazCreateUpscale } from "@/lib/topaz";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { inputUrl } = await req.json();
    if (!inputUrl || typeof inputUrl !== 'string') {
      return NextResponse.json({ error: 'inputUrl requis (URL publique vidéo)' }, { status: 400 });
    }
    const { taskId } = await topazCreateUpscale(inputUrl);
    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upscale failed' }, { status: 400 });
  }
}


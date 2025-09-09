export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { topazCreateUpscale, buildTopazCreateBody } from "@/lib/topaz";

export async function POST(req: NextRequest) {
  // Tiny temporary env check: return basic config if ?debug=1
  {
    const u = new URL(req.url);
    if (u.searchParams.get("debug") === "1") {
      const hasKey = !!process.env.TOPAZ_API_KEY;
      const authHeader = process.env.TOPAZ_AUTH_HEADER || "X-API-Key";
      const scheme = process.env.TOPAZ_AUTH_SCHEME ? "<set>" : "<empty>";
      const base = (process.env.TOPAZ_BASE || "https://api.topazlabs.com").replace(/\/+$/, "");
      const path = process.env.TOPAZ_CREATE_PATH || "/video/";
      const endpoint = `${base}${path}`;
      return NextResponse.json({ hasKey, authHeader, scheme, endpoint });
    }
  }

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const urlObj = new URL(req.url);
    const debugFlag = urlObj.searchParams.get("debug") === "1";
    const { inputUrl, debug } = await req.json();
    if (!inputUrl || typeof inputUrl !== 'string') {
      return NextResponse.json({ error: 'inputUrl requis (URL publique vidéo)' }, { status: 400 });
    }
    // Debug mode: return outgoing request without calling provider
    if (debug === true || debugFlag) {
      const base = (process.env.TOPAZ_BASE || "https://api.topazlabs.com").replace(/\/+$/, "");
      const path = process.env.TOPAZ_CREATE_PATH || "/video/";
      const endpoint = `${base}${path}`;
      const body = await buildTopazCreateBody(inputUrl);
      return NextResponse.json({ debug: true, endpoint, body });
    }
    const { taskId } = await topazCreateUpscale(inputUrl);
    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upscale failed' }, { status: 400 });
  }
}

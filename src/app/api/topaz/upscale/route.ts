export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { topazCreateUpscale, buildTopazCreateBody } from "@/lib/topaz";
import { getBilling, ensurePeriod } from "@/lib/billing";

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
    // Gate 4K to eligible subscriptions
    const uid = String((session.user as any).id || '');
    const rec = await getBilling(uid);
    if (!rec || !rec.subscriptionStatus || !['trialing','active','past_due'].includes(rec.subscriptionStatus)) {
      return NextResponse.json({ error: 'subscription_required' }, { status: 402 });
    }
    await ensurePeriod(uid, rec);
    const urlObj = new URL(req.url);
    const debugFlag = urlObj.searchParams.get("debug") === "1";
    const { inputUrl, debug, meta } = await req.json();
    if (!inputUrl || typeof inputUrl !== 'string') {
      return NextResponse.json({ error: 'inputUrl requis (URL publique vidéo)' }, { status: 400 });
    }
    // Debug mode: return outgoing request without calling provider
    if (debug === true || debugFlag) {
      const base = (process.env.TOPAZ_BASE || "https://api.topazlabs.com").replace(/\/+$/, "");
      const path = process.env.TOPAZ_CREATE_PATH || "/video/";
      const endpoint = `${base}${path}`;
      const body = await buildTopazCreateBody(inputUrl, meta);
      return NextResponse.json({ debug: true, endpoint, body });
    }
    const { taskId } = await topazCreateUpscale(inputUrl, meta);
    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upscale failed' }, { status: 400 });
  }
}

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { topazCreateUpscale } from "@/lib/topaz";

export async function POST(req: NextRequest) {
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
      const path = process.env.TOPAZ_CREATE_PATH || "/v1/video/jobs";
      const endpoint = `${base}${path}`;
      const body: Record<string, any> = {
        input_url: inputUrl,
        operations: {
          upscale: {
            model: "proteus",
            scale: 2,
            noise: 0,
            recover_detail: 100,
            focus_fix: false,
            grain: 0,
            mode: "dynamic",
            fix_compression: 0,
            improve_details: 100,
            sharpen: 0,
            reduce_noise: 0,
            dehalo: 0,
            anti_alias_deblur: 100,
          },
          frame_interpolation: {
            fps: 60,
            ai_model: "chronos_fast",
            duplicate_frames: "replace",
            sensitivity: 10,
          },
        },
      };
      const extra = process.env.TOPAZ_EXTRA_JSON;
      if (extra) {
        try { Object.assign(body, JSON.parse(extra)); } catch {}
      }
      return NextResponse.json({ debug: true, endpoint, body });
    }
    const { taskId } = await topazCreateUpscale(inputUrl);
    return NextResponse.json({ taskId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upscale failed' }, { status: 400 });
  }
}

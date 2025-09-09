export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { saveVideoFromUrl } from "@/lib/library";

export async function POST(req: NextRequest) {
  const session = await auth();
  const uid = session?.user?.email;
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { videoUrl, title, project, tags, posterUrl } = await req.json();
    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json({ error: 'videoUrl requis' }, { status: 400 });
    }
    const item = await saveVideoFromUrl(String(uid), videoUrl, {
      title: typeof title === 'string' ? title : undefined,
      project: typeof project === 'string' ? project : undefined,
      tags: Array.isArray(tags) ? tags.filter((x: any) => typeof x === 'string') : undefined,
      posterUrl: typeof posterUrl === 'string' ? posterUrl : undefined,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'save failed' }, { status: 400 });
  }
}

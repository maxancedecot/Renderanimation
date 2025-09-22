export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { saveVideoFromUrl } from "@/lib/library";
import { decrementVideoCredit } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const session = await auth();
  const uidEmail = session?.user?.email;
  if (!uidEmail) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { videoUrl, title, project, tags, folderId } = await req.json();
    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json({ error: 'videoUrl requis' }, { status: 400 });
    }
    // Consume 1 video if not a 4K-only save
    const is4k = Array.isArray(tags) && tags.includes('4k');
    const userIdForBilling = String((session.user as any).id || '');
    if (!is4k && userIdForBilling) {
      await decrementVideoCredit(userIdForBilling).catch(() => {});
    }
    const item = await saveVideoFromUrl(String(uidEmail), videoUrl, {
      title: typeof title === 'string' ? title : undefined,
      project: typeof project === 'string' ? project : undefined,
      tags: Array.isArray(tags) ? tags.filter((x: any) => typeof x === 'string') : undefined,
      folderId: typeof folderId === 'string' ? folderId : undefined,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'save failed' }, { status: 400 });
  }
}

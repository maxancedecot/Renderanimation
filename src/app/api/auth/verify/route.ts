export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getEmailVerificationRecord, consumeEmailVerificationToken, markUserVerified } from "@/lib/users";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    const rec = await getEmailVerificationRecord(token);
    if (!rec) return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    if (rec.exp < Math.floor(Date.now() / 1000)) {
      await consumeEmailVerificationToken(token);
      return NextResponse.json({ error: 'expired_token' }, { status: 400 });
    }
    const ok = await markUserVerified(rec.userId);
    await consumeEmailVerificationToken(token);
    if (!ok) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'verify_failed' }, { status: 500 });
  }
}


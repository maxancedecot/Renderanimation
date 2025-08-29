export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getPasswordResetRecord, consumePasswordResetToken, updateUserPassword } from "@/lib/users";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || typeof token !== "string" || !password || String(password).length < 6) {
      return NextResponse.json({ error: "token invalide ou mot de passe trop court" }, { status: 400 });
    }
    const rec = await getPasswordResetRecord(token);
    if (!rec) return NextResponse.json({ error: "token introuvable" }, { status: 400 });
    if (rec.exp < Math.floor(Date.now() / 1000)) {
      await consumePasswordResetToken(token);
      return NextResponse.json({ error: "token expiré" }, { status: 400 });
    }
    const ok = await updateUserPassword(rec.userId, String(password));
    await consumePasswordResetToken(token);
    if (!ok) return NextResponse.json({ error: "utilisateur introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "reset failed" }, { status: 500 });
  }
}


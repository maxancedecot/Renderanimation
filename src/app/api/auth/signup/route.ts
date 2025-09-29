export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { addUser } from "@/lib/users";

function isEmail(s: string): boolean {
  return /.+@.+\..+/.test(s);
}

export async function POST(req: NextRequest) {
  try {
    const allow = (process.env.ALLOW_PUBLIC_SIGNUP || 'true').toLowerCase();
    if (allow !== 'true' && allow !== '1' && allow !== 'yes') {
      return NextResponse.json({ error: 'signup_disabled' }, { status: 403 });
    }
    const { email, password, name } = await req.json();
    const em = String(email || '').trim();
    const pw = String(password || '');
    const nm = name ? String(name).trim() : undefined;
    if (!em || !pw) return NextResponse.json({ error: 'missing_email_or_password' }, { status: 400 });
    if (!isEmail(em)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    if (pw.length < 6) return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
    const user = await addUser({ email: em, password: pw, name: nm });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || '')
    const status = /existant|exist/i.test(msg) ? 409 : 400;
    return NextResponse.json({ error: msg || 'signup_failed' }, { status });
  }
}


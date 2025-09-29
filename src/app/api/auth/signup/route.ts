export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { addUser, createEmailVerificationToken } from "@/lib/users";
import { sendEmail } from "@/lib/mail";

function isEmail(s: string): boolean {
  return /.+@.+\..+/.test(s);
}

function originFromReq(req: NextRequest): string {
  try { return new URL(req.url).origin; } catch { return process.env.APP_BASE_URL || "http://localhost:3000"; }
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
    // Send verification email
    const token = await createEmailVerificationToken(user.id, user.email, 7 * 24 * 3600);
    const base = originFromReq(req);
    const link = `${base}/verify?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify your email',
      html: `<p>Welcome!</p><p>Confirm your email by clicking the link below:</p><p><a href="${link}">${link}</a></p>`,
      text: `Verify your email: ${link}`,
    });
    return NextResponse.json({ user, sent: true }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || '')
    const status = /existant|exist/i.test(msg) ? 409 : 400;
    return NextResponse.json({ error: msg || 'signup_failed' }, { status });
  }
}

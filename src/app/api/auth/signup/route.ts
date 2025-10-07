export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { addUser, createEmailVerificationToken, findUserByEmail } from "@/lib/users";
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
    // If user already exists, handle accordingly
    const existing = await findUserByEmail(em);
    if (existing) {
      if ((existing as any).verified === false) {
        // Resend verification email
        const token = await createEmailVerificationToken(existing.id, existing.email, 7 * 24 * 3600);
        const base = originFromReq(req);
        const link = `${base}/verify?token=${encodeURIComponent(token)}`;
        const emailResult = await sendEmail({
          to: existing.email,
          subject: 'Verify your email',
          html: `<p>Welcome back!</p><p>Confirm your email by clicking the link below:</p><p><a href="${link}">${link}</a></p>`,
          text: `Verify your email: ${link}`,
        });
        if (!emailResult.ok) {
          throw new Error(emailResult.error || 'email_send_failed');
        }
        const devEcho = (process.env.MAIL_DEV_ECHO || '').toLowerCase();
        const shouldEcho = devEcho === '1' || devEcho === 'true' || devEcho === 'yes';
        return NextResponse.json({ resent: true, devLink: shouldEcho ? link : undefined }, { status: 200 });
      }
      return NextResponse.json({ error: 'user_exists' }, { status: 409 });
    }

    const user = await addUser({ email: em, password: pw, name: nm });
    // Send verification email
    const token = await createEmailVerificationToken(user.id, user.email, 7 * 24 * 3600);
    const base = originFromReq(req);
    const link = `${base}/verify?token=${encodeURIComponent(token)}`;
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Verify your email',
      html: `<p>Welcome!</p><p>Confirm your email by clicking the link below:</p><p><a href="${link}">${link}</a></p>`,
      text: `Verify your email: ${link}`,
    });
    if (!emailResult.ok) {
      throw new Error(emailResult.error || 'email_send_failed');
    }
    const devEcho = (process.env.MAIL_DEV_ECHO || '').toLowerCase();
    const shouldEcho = devEcho === '1' || devEcho === 'true' || devEcho === 'yes';
    return NextResponse.json({ user, sent: true, devLink: shouldEcho ? link : undefined }, { status: 201 });
  } catch (e: any) {
    console.error('signup error:', e);
    const msg = String(e?.message || '');
    const status = /existant|exist/i.test(msg)
      ? 409
      : /email|smtp|resend|missing_from|provider/i.test(msg)
        ? 500
        : 400;
    return NextResponse.json({ error: msg || 'signup_failed' }, { status });
  }
}

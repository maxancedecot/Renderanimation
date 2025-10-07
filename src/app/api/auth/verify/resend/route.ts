export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createEmailVerificationToken } from "@/lib/users";
import { sendEmail } from "@/lib/mail";

function originFromReq(req: NextRequest): string {
  try { return new URL(req.url).origin; } catch { return process.env.APP_BASE_URL || "http://localhost:3000"; }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const em = String(email || '').trim();
    if (!em) return NextResponse.json({ error: 'missing_email' }, { status: 400 });
    const u = await findUserByEmail(em);
    if (!u) return NextResponse.json({ ok: true, status: 'no_user' });
    if ((u as any).verified) return NextResponse.json({ ok: true, status: 'already_verified' });
    const token = await createEmailVerificationToken(u.id, u.email, 7 * 24 * 3600);
    const base = originFromReq(req);
    const link = `${base}/verify?token=${encodeURIComponent(token)}`;
    const emailResult = await sendEmail({
      to: u.email,
      subject: 'Verify your email',
      html: `<p>Hello!</p><p>Confirm your email by clicking the link below:</p><p><a href="${link}">${link}</a></p>`,
      text: `Verify your email: ${link}`,
    });
    if (!emailResult.ok) {
      throw new Error(emailResult.error || 'email_send_failed');
    }
    const devEcho = (process.env.MAIL_DEV_ECHO || '').toLowerCase();
    const shouldEcho = devEcho === '1' || devEcho === 'true' || devEcho === 'yes';
    return NextResponse.json({ ok: true, status: 'resent', devLink: shouldEcho ? link : undefined });
  } catch (e: any) {
    console.error('verify resend error:', e);
    return NextResponse.json({ error: e?.message || 'resend_failed' }, { status: 500 });
  }
}

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createPasswordResetToken } from "@/lib/users";
import { sendEmail } from "@/lib/mail";

function originFromReq(req: NextRequest): string {
  try { return new URL(req.url).origin; } catch { return process.env.APP_BASE_URL || "http://localhost:3000"; }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const user = email ? await findUserByEmail(String(email)) : null;

    if (user) {
      const token = await createPasswordResetToken(user.id, user.email, 3600);
      const base = originFromReq(req);
      const link = `${base}/reset?token=${encodeURIComponent(token)}`;
      const emailResult = await sendEmail({
        to: user.email,
        subject: "Réinitialisation du mot de passe",
        html: `<p>Bonjour,</p><p>Pour créer un nouveau mot de passe, clique sur le lien ci-dessous (valide 1h):</p><p><a href="${link}">${link}</a></p>`,
        text: `Lien de réinitialisation (valide 1h): ${link}`,
      });
      if (!emailResult.ok) {
        console.error('forgot password email failed:', emailResult.error);
      }
    }
    // Toujours répondre 200 pour éviter l'énumération
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: true });
  }
}

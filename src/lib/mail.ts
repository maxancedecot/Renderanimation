// src/lib/mail.ts
// Minimal email sender using either Resend API or SMTP (nodemailer)

export type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string; // optional override
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const from =
    input.from ||
    process.env.MAIL_FROM ||
    process.env.RESEND_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    "";

  if (!from) {
    console.error("sendEmail: missing FROM address configuration");
    return { ok: false, error: "missing_from_address" };
  }

  // Prefer Resend if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: j?.message || `HTTP ${r.status}` };
      return { ok: true, id: j?.id };
    } catch (e: any) {
      return { ok: false, error: e?.message || "resend failed" };
    }
  }

  // Fallback: SMTP via nodemailer (installed at deploy time)
  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import("nodemailer");
      const secure = (() => {
        const v = String(process.env.SMTP_SECURE || '').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes';
      })();
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      const info = await transport.sendMail({ from, to: input.to, subject: input.subject, html: input.html, text: input.text });
      return { ok: true, id: info.messageId };
    } catch (e: any) {
      console.error("SMTP send failed:", e);
      return { ok: false, error: e?.message || "smtp failed" };
    }
  }

  // Last resort: log the link
  console.warn("sendEmail fallback: no provider configured. Intended to:", input);
  return { ok: process.env.NODE_ENV !== "production", id: process.env.NODE_ENV !== "production" ? "dev-fallback" : undefined, error: process.env.NODE_ENV === "production" ? "no_provider_configured" : undefined };
}

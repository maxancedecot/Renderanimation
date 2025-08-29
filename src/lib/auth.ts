import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserByEmail, verifyPassword, ensureDefaultAdmin } from "@/lib/users";

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Demo",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Ensure default admin exists if configured
        try { await ensureDefaultAdmin(); } catch {}
        const credEmail = credentials?.email || "";
        const credPass = credentials?.password || "";
        if (!credEmail || !credPass) return null;

        // Try R2 users first
        try {
          const u = await findUserByEmail(credEmail);
          if (u) {
            const ok = verifyPassword(credPass, u.passwordHash);
            if (ok) return { id: u.id, name: u.name || u.email, email: u.email } as any;
          }
        } catch {
          // ignore and fall back to demo account
        }

        // Fallback demo account (optional)
        const demoEmail = process.env.DEMO_LOGIN_EMAIL || "demo@client.test";
        const demoPass  = process.env.DEMO_LOGIN_PASSWORD || "demo1234";
        if (credEmail === demoEmail && credPass === demoPass) {
          return { id: "demo", name: "Demo User", email: demoEmail } as any;
        }
        return null;
      }
    })
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/signin" },
};

export function auth() {
  // App Router: on peut appeler getServerSession avec les options
  return getServerSession(authOptions);
}

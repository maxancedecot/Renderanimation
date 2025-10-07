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
            // Allow if password ok and either verified or missing flag (legacy users)
            const verified = (u as any).verified;
            const isAdmin = !!(u as any).admin;
            if (ok && (verified === true || typeof verified === 'undefined')) {
              return { id: u.id, name: u.name || u.email, email: u.email, isAdmin } as any;
            }
            // If not verified, reject
          }
        } catch {
          // ignore and fall back to demo account
        }

        // Fallback demo account (optional)
        const demoEmail = process.env.DEMO_LOGIN_EMAIL || "demo@client.test";
        const demoPass  = process.env.DEMO_LOGIN_PASSWORD || "demo1234";
        if (credEmail === demoEmail && credPass === demoPass) {
          return { id: "demo", name: "Demo User", email: demoEmail, isAdmin: true } as any;
        }
        return null;
      }
    })
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Persist the user id on the token
        (token as any).uid = (user as any).id || (token as any).uid || token.sub;
        (token as any).isAdmin = (user as any).isAdmin === true;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose id on session.user for server/client usage
      if (session.user) {
        (session.user as any).id = (token as any).uid || token.sub || '';
        (session.user as any).isAdmin = (token as any).isAdmin === true;
      }
      return session;
    }
  }
};

export function auth() {
  // App Router: on peut appeler getServerSession avec les options
  return getServerSession(authOptions);
}

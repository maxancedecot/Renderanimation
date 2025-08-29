// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const runtime = "nodejs";

const handler = NextAuth({
  providers: [
    Credentials({
      name: "Demo",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = process.env.DEMO_LOGIN_EMAIL || "demo@client.test";
        const pass  = process.env.DEMO_LOGIN_PASSWORD || "demo1234";
        if (credentials?.email === email && credentials?.password === pass) {
          return { id: "1", name: "Demo User", email };
        }
        return null;
      }
    })
  ],
  // on utilise NOTRE page /signin (plus fiable que /api/auth/signin)
  pages: { signIn: "/signin" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async redirect({ baseUrl }) {
      return baseUrl; // après login, redirige vers /
    },
  },
});

export { handler as GET, handler as POST };
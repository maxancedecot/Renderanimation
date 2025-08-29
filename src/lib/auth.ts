import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
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
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/signin" },
};

export function auth() {
  // App Router: on peut appeler getServerSession avec les options
  return getServerSession(authOptions);
}
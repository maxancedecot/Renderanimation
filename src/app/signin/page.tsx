"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("demo@client.test");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("credentials", {
      redirect: true,
      callbackUrl: "/",
      email,
      password,
    });
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6 rounded-xl bg-white shadow">
        <h1 className="text-xl font-semibold">Se connecter</h1>
        <label className="block text-sm">
          Email
          <input
            className="w-full border rounded-lg p-2 mt-1"
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Mot de passe
          <input
            className="w-full border rounded-lg p-2 mt-1"
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded-lg py-2 disabled:opacity-60"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
        <div className="flex items-center justify-between text-xs mt-2">
          <a href="/forgot" className="underline text-neutral-600 hover:text-neutral-800">Mot de passe oublié ?</a>
          <span className="text-neutral-400">Demo: demo@client.test / demo1234</span>
        </div>
      </form>
    </div>
  );
}

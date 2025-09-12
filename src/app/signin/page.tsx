"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { getClientLang, t } from "@/lib/i18n";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const lang = getClientLang();

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
    <div className="grid min-h-[70vh] place-items-center bg-neutral-50 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6 rounded-xl bg-white shadow">
        <h1 className="text-xl font-semibold">{t(lang, 'signinTitle')}</h1>
        <label className="block text-sm">
          {t(lang, 'signinEmail')}
          <input
            className="w-full border rounded-lg p-2 mt-1"
            type="email"
            placeholder={t(lang, 'signinEmailPlaceholder')}
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          {t(lang, 'signinPassword')}
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
          {loading ? t(lang, 'signinSubmitting') : t(lang, 'signinSubmit')}
        </button>
        <div className="flex items-center justify-start text-xs mt-2">
          <a href="/forgot" className="underline text-neutral-600 hover:text-neutral-800">{t(lang, 'signinForgot')}</a>
        </div>
      </form>
    </div>
  );
}

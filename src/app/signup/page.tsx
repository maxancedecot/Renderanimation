"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { getClientLang, t } from "@/lib/i18n";
import toast from "react-hot-toast";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const lang = getClientLang();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const p = toast.loading(t(lang, 'signupSubmitting'));
    try {
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'signup_failed');
      toast.success(t(lang, 'signupSuccess'), { id: p });
      // Auto sign-in after signup
      await signIn('credentials', { redirect: true, callbackUrl: '/', email, password });
    } catch (e: any) {
      toast.error(e?.message || t(lang, 'signupFailed'), { id: p });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-[70vh] place-items-center bg-neutral-50 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6 rounded-xl bg-white shadow">
        <h1 className="text-xl font-semibold">{t(lang, 'signupTitle')}</h1>
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
        <label className="block text-sm">
          {t(lang, 'signupName')}
          <input
            className="w-full border rounded-lg p-2 mt-1"
            type="text"
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder={t(lang, 'signupNamePlaceholder')}
          />
        </label>
        <button
          type="submit"
          disabled={loading || password.length < 6}
          className="w-full bg-black text-white rounded-lg py-2 disabled:opacity-60"
        >
          {loading ? t(lang, 'signupSubmitting') : t(lang, 'signupSubmit')}
        </button>
        <div className="flex items-center justify-between text-xs mt-2">
          <a href="/signin" className="underline text-neutral-600 hover:text-neutral-800">{t(lang, 'haveAccount')}</a>
        </div>
      </form>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getClientLang, t } from "@/lib/i18n";

export default function VerifyPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get('token') || '';
  const [state, setState] = useState<'idle'|'ok'|'err'|'loading'>('idle');
  const lang = getClientLang();

  useEffect(() => {
    if (!token || state !== 'idle') return;
    setState('loading');
    (async () => {
      try {
        const r = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
        if (!r.ok) throw new Error('verify_failed');
        setState('ok');
        setTimeout(() => router.push('/login'), 1500);
      } catch {
        setState('err');
      }
    })();
  }, [token, state, router]);

  return (
    <div className="grid min-h-[70vh] place-items-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm space-y-3 p-6 rounded-xl bg-white shadow text-center">
        <h1 className="text-xl font-semibold">{t(lang, 'verifyTitle')}</h1>
        {state === 'loading' && <p className="text-sm text-neutral-600">{t(lang, 'verifyInProgress')}</p>}
        {state === 'ok' && <p className="text-sm text-green-700">{t(lang, 'verifySuccess')}</p>}
        {state === 'err' && <p className="text-sm text-red-700">{t(lang, 'verifyError')}</p>}
        <a href="/login" className="inline-block mt-2 underline text-neutral-700">{t(lang, 'navSignin')}</a>
      </div>
    </div>
  );
}


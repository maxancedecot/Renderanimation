"use client";
import { useEffect, useState } from 'react';

type Props = { initial: 'fr' | 'en' | 'nl' };

export default function LanguageSwitcher({ initial }: Props) {
  const [lang, setLang] = useState<Props['initial']>(initial);
  useEffect(() => {
    try {
      const cookie = document.cookie.split('; ').find(c => c.startsWith('lang='));
      if (cookie) setLang(cookie.split('=')[1] as Props['initial']);
    } catch {}
  }, []);
  const set = (v: Props['initial']) => {
    setLang(v);
    try { document.cookie = `lang=${v}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch {}
    window.location.reload();
  };
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/5 px-1 py-1 text-xs text-neutral-700 dark:bg-white/10">
      {(['fr','en','nl'] as const).map((v) => (
        <button
          key={v}
          onClick={() => set(v)}
          className={`${lang === v ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-neutral-700/80 hover:text-black dark:text-white/80 dark:hover:text-white'} px-2 py-0.5 rounded-full transition`}
          aria-pressed={lang === v}
        >
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

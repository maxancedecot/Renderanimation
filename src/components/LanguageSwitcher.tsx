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
    <div className="flex items-center gap-1 rounded-full bg-neutral-100 px-1 py-1 text-xs text-neutral-700 dark:bg-white/10">
      {(['fr','en','nl'] as const).map((v) => (
        <button
          key={v}
          onClick={() => set(v)}
          className={`${lang === v ? 'bg-[#F9D83C] text-black shadow-sm' : 'text-neutral-400 hover:text-neutral-700 dark:text-white/60 dark:hover:text-white'} px-2.5 py-1 rounded-full transition`}
          aria-pressed={lang === v}
        >
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

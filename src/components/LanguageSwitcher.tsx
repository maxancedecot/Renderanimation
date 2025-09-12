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
  return (
    <select
      aria-label="Language"
      className="rounded-md border px-2 py-1 text-xs bg-white/80"
      value={lang}
      onChange={(e) => {
        const v = e.target.value as Props['initial'];
        setLang(v);
        try {
          document.cookie = `lang=${v}; Path=/; Max-Age=31536000; SameSite=Lax`;
        } catch {}
        window.location.reload();
      }}
    >
      <option value="fr">FR</option>
      <option value="en">EN</option>
      <option value="nl">NL</option>
    </select>
  );
}


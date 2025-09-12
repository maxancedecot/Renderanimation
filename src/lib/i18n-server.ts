import { headers, cookies } from 'next/headers';
import { Lang, normalizeLang } from './i18n';

export function getRequestLang(): Lang {
  const cookieLang = cookies().get('lang')?.value;
  if (cookieLang) return normalizeLang(cookieLang);
  const accept = headers().get('accept-language') || '';
  const top = accept.split(',')[0] || '';
  return normalizeLang(top);
}


export type Lang = 'fr' | 'en' | 'nl';

const M: Record<Lang, Record<string, string>> = {
  fr: {
    pricingTitle: 'Tarifs (abonnement)',
    pricingSubtitle: 'Nombre de vidéos incluses par mois.',
    subscribe: "S’abonner",
    videosPerMonth: '{count} vidéos / mois',
    discount10: '10% moins cher',
    discount20: '20% moins cher',
    language: 'Langue',
  },
  en: {
    pricingTitle: 'Pricing (subscription)',
    pricingSubtitle: 'Number of videos included per month.',
    subscribe: 'Subscribe',
    videosPerMonth: '{count} videos / month',
    discount10: '10% cheaper',
    discount20: '20% cheaper',
    language: 'Language',
  },
  nl: {
    pricingTitle: 'Prijzen (abonnement)',
    pricingSubtitle: 'Aantal video’s per maand inbegrepen.',
    subscribe: 'Abonneren',
    videosPerMonth: "{count} video's / maand",
    discount10: '10% goedkoper',
    discount20: '20% goedkoper',
    language: 'Taal',
  },
};

export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const base = M[lang]?.[key] ?? M.fr[key] ?? key;
  return Object.keys(vars).reduce((s, k) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k])), base);
}

export function normalizeLang(input: unknown): Lang {
  const v = String(input || '').toLowerCase();
  if (v.startsWith('en')) return 'en';
  if (v.startsWith('nl')) return 'nl';
  return 'fr';
}


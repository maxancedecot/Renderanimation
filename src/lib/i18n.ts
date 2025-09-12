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
    howItWorks: 'Comment ça marche',
    navPricing: 'Tarifs',
    navApp: 'App',
    navLibrary: 'Bibliothèque',
    navAccount: 'Espace',
    navSignin: 'Connexion',
    heroTitle: 'Anime tes rendus 3D en 3 clics',
    heroSub: "Upload → Analyse de l’image → Génération de vidéo. Parfait pour les promoteurs immobiliers et studios d’archi qui veulent animer des rendus statiques sans budget vidéo exorbitant.",
    ctaSignIn: 'Se connecter',
    ctaSeePricing: 'Voir les tarifs',
    stepsTitle1: 'Upload',
    stepsDesc1: 'Importez votre rendu (JPG/PNG).',
    stepsTitle2: 'Analyse',
    stepsDesc2: 'L’image est analysée pour en extraire un prompt adapté.',
    stepsTitle3: 'Génération',
    stepsDesc3: 'Création automatique de la vidéo à partir du rendu.',
    reviewsTitle: 'Avis clients',
    footer: 'Propulsé par Maxance Decot 🚀',
  },
  en: {
    pricingTitle: 'Pricing (subscription)',
    pricingSubtitle: 'Number of videos included per month.',
    subscribe: 'Subscribe',
    videosPerMonth: '{count} videos / month',
    discount10: '10% cheaper',
    discount20: '20% cheaper',
    language: 'Language',
    howItWorks: 'How it works',
    navPricing: 'Pricing',
    navApp: 'App',
    navLibrary: 'Library',
    navAccount: 'Account',
    navSignin: 'Sign in',
    heroTitle: 'Animate your 3D renders in 3 clicks',
    heroSub: 'Upload → Analyze → Generate video. Perfect for real-estate marketers and arch studios who want motion without a big video budget.',
    ctaSignIn: 'Sign in',
    ctaSeePricing: 'See pricing',
    stepsTitle1: 'Upload',
    stepsDesc1: 'Import your render (JPG/PNG).',
    stepsTitle2: 'Analyze',
    stepsDesc2: 'We analyze the image to craft a suitable prompt.',
    stepsTitle3: 'Generate',
    stepsDesc3: 'Automatically create the video from your still.',
    reviewsTitle: 'Customer reviews',
    footer: 'Powered by Maxance Decot 🚀',
  },
  nl: {
    pricingTitle: 'Prijzen (abonnement)',
    pricingSubtitle: 'Aantal video’s per maand inbegrepen.',
    subscribe: 'Abonneren',
    videosPerMonth: "{count} video's / maand",
    discount10: '10% goedkoper',
    discount20: '20% goedkoper',
    language: 'Taal',
    howItWorks: 'Hoe het werkt',
    navPricing: 'Prijzen',
    navApp: 'App',
    navLibrary: 'Bibliotheek',
    navAccount: 'Account',
    navSignin: 'Inloggen',
    heroTitle: 'Animeer je 3D-renders in 3 klikken',
    heroSub: 'Upload → Analyse → Video genereren. Ideaal voor vastgoedmarketeers en bureaus die beweging willen zonder groot videobudget.',
    ctaSignIn: 'Inloggen',
    ctaSeePricing: 'Prijzen bekijken',
    stepsTitle1: 'Upload',
    stepsDesc1: 'Upload je render (JPG/PNG).',
    stepsTitle2: 'Analyse',
    stepsDesc2: 'We analyseren de afbeelding en maken een passend prompt.',
    stepsTitle3: 'Genereren',
    stepsDesc3: 'Maak automatisch de video van je stilstaande beeld.',
    reviewsTitle: 'Klantreviews',
    footer: 'Aangedreven door Maxance Decot 🚀',
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

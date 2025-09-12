// src/app/page.tsx — public landing page (concept + pricing)
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/i18n-server";

export const metadata = {
  title: "RenderAnimation — Anime tes rendus 3D",
  description: "Landing page: concept, bénéfices et tarifs par vidéos/mois.",
};

export default function Page() {
  const lang = getRequestLang();
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 p-8 md:p-12">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/logo%20ra.png"
              alt="RenderAnimation"
              className="h-8 w-auto mb-2 invert-dark"
            />
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{t(lang, 'heroTitle')}</h1>
            <p className="text-neutral-600">{t(lang, 'heroSub')}</p>
            <div className="flex gap-3 pt-1">
              <a href="/signin" className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90">{t(lang, 'ctaSignIn')}</a>
              <a href="#pricing" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800">{t(lang, 'ctaSeePricing')}</a>
            </div>
          </div>
          <div className="relative">
            <video
              src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/exemple.mp4"
              className="w-full rounded-2xl shadow-sm"
              autoPlay
              loop
              muted
              playsInline
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/Favicon.png"
              alt="RenderAnimation"
              className="absolute bottom-3 left-3 h-8 w-8 rounded-md shadow-md invert-dark"
            />
          </div>
        </div>
      </section>

      {/* Pour qui */}
      <section className="grid md:grid-cols-3 gap-6">
        {[
          {
            title: "Promoteurs immobiliers",
            desc: "Créez rapidement des vidéos fluides pour valoriser vos lots sur les réseaux et sites de vente.",
          },
          {
            title: "Architectes & studios",
            desc: "Animez vos rendus sans pipeline vidéo complexe. Gardez la cohérence des matériaux et lumières.",
          },
          {
            title: "Marketing & agences",
            desc: "Produisez plus de contenus 3D à coût maîtrisé. Idéal pour A/B tests et social ads.",
          },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold">{c.title}</h3>
            <p className="text-sm text-neutral-600 mt-2">{c.desc}</p>
          </div>
        ))}
      </section>

      {/* Logos (défilement automatique) */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm overflow-hidden">
        <div className="relative w-full">
          <div className="flex items-center gap-12 whitespace-nowrap animate-scroll-x will-change-transform">
            {[
              "Archimax",
              "NeoBuild",
              "Urbania",
              "ProImmo",
              "RenderLab",
              "Habitat+",
              "Vision3D",
              "Skylines",
            ].map((name, idx) => (
              <div key={`logo1-${idx}`} className="shrink-0 h-10 px-5 grid place-items-center rounded-lg ring-1 ring-black/5 bg-white text-neutral-700 font-medium">
                {name}
              </div>
            ))}
            {[
              "Archimax",
              "NeoBuild",
              "Urbania",
              "ProImmo",
              "RenderLab",
              "Habitat+",
              "Vision3D",
              "Skylines",
            ].map((name, idx) => (
              <div key={`logo2-${idx}`} className="shrink-0 h-10 px-5 grid place-items-center rounded-lg ring-1 ring-black/5 bg-white text-neutral-700 font-medium">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t(lang, 'howItWorks')}</h2>
        <div className="grid md:grid-cols-3 gap-4 text-center mt-4">
          {[
            { n: 1, t: t(lang, 'stepsTitle1'), d: t(lang, 'stepsDesc1') },
            { n: 2, t: t(lang, 'stepsTitle2'), d: t(lang, 'stepsDesc2') },
            { n: 3, t: t(lang, 'stepsTitle3'), d: t(lang, 'stepsDesc3') },
          ].map((s) => (
            <div key={s.n} className="rounded-xl bg-white p-5 ring-1 ring-black/5">
              <div className="text-2xl font-semibold step-number">{s.n}</div>
              <div className="mt-1 text-sm font-medium">{s.t}</div>
              <div className="mt-1 text-xs text-neutral-600">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tarifs */}
      <section id="pricing" className="space-y-4">
        <h2 className="text-lg font-semibold">{t(lang, 'pricingTitle')}</h2>
        <p className="text-sm text-neutral-600">{t(lang, 'pricingSubtitle')}</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { price: "25€", count: 5 },
            { price: "45€", count: 10, discountKey: 'discount10', highlight: true },
            { price: "80€", count: 20, discountKey: 'discount20' },
          ].map((p) => (
            <div key={p.price} className={`rounded-2xl border bg-white p-6 shadow-sm ${p.highlight ? "ring-2 ring-[#F9D83C] border-[#F9D83C]" : ""}`}>
              <div className="text-3xl font-semibold flex items-baseline gap-3">
                <span>{p.price}</span>
                {p.discountKey ? (
                  <span className="text-xs font-medium text-green-700 bg-green-100 rounded px-2 py-0.5 ring-1 ring-green-300">{t(lang, p.discountKey)}</span>
                ) : null}
              </div>
              <div className="mt-1 text-sm text-neutral-600">{t(lang, 'videosPerMonth', { count: p.count })}</div>
              <div className="mt-4">
                <a href="/signin" className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 w-full">
                  {t(lang, 'subscribe')}
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500">Prix HT indicatifs. Annulation à tout moment.</p>
      </section>

      {/* Avis clients */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t(lang, 'reviewsTitle')}</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-4">
          {[
            {
              q: "En 10 minutes j’ai des vidéos propres pour nos lots – gain de temps énorme.",
              a: "Nicolas R.",
              r: "Directeur marketing, promoteur",
            },
            {
              q: "Le rendu final respecte bien matériaux et éclairage, parfait pour nos présentations.",
              a: "Sarah B.",
              r: "Architecte associée",
            },
            {
              q: "Idéal pour produire des assets 3D pour nos campagnes social à coût maîtrisé.",
              a: "Mehdi K.",
              r: "Head of Growth, agence",
            },
          ].map((t, i) => (
            <figure key={i} className="rounded-xl bg-white p-5 ring-1 ring-black/5">
              <blockquote className="text-sm text-neutral-700">“{t.q}”</blockquote>
              <figcaption className="mt-3 text-xs text-neutral-500">{t.a} · {t.r}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      
    </div>
  );
}

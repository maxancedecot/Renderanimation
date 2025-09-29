// src/app/page.tsx — public landing page (concept + pricing)
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/i18n-server";
import Script from "next/script";
import { auth } from "@/src/lib/auth";

export const metadata = {
  title: "RenderAnimation — Anime tes rendus 3D",
  description: "Landing page: concept, bénéfices et tarifs par vidéos/mois.",
};

export default async function Page() {
  const lang = getRequestLang();
  const session = await auth();
  const uid = session?.user ? (String((session.user as any).id || '')) : undefined;
  const email = session?.user?.email || undefined;
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 p-8 md:p-12">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            {/* Logo au-dessus du titre retiré */}
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{t(lang, 'heroTitle')}</h1>
            <p className="text-neutral-600">{t(lang, 'heroSub')}</p>
            <div className="flex gap-3 pt-1">
              <a href="/signin" className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90">{t(lang, 'ctaSignIn')}</a>
              <a href="#pricing" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50">{t(lang, 'ctaSeePricing')}</a>
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
              src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/ledoux-embleem.png"
              alt="RenderAnimation"
              className="absolute bottom-3 left-3 h-8 w-8 rounded-md shadow-md"
            />
          </div>
        </div>
      </section>

      {/* Pour qui */}
      <section className="grid md:grid-cols-3 gap-6">
        {[
          { title: t(lang, 'audience1Title'), desc: t(lang, 'audience1Desc') },
          { title: t(lang, 'audience2Title'), desc: t(lang, 'audience2Desc') },
          { title: t(lang, 'audience3Title'), desc: t(lang, 'audience3Desc') },
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

      {/* Tarifs — Stripe Pricing Table (localized) */}
      <section id="pricing" className="space-y-4">
        <Script async src="https://js.stripe.com/v3/pricing-table.js" />
        {(() => {
          const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_51S5a1eKGUOwmR3N2eyoF6oXiHGPNxPN1Ag4aTZLCwYc4KmZYxRqThb6566sT5CL46moYeisRBnvePkZ6QMsZsXGi00SOmVNsgz";
          const map: Record<string, string | undefined> = {
            fr: process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID_FR,
            en: process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID_EN,
            nl: process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID_NL,
          };
          const fallback = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID || "prctbl_1S6g94KGUOwmR3N2nzXOF3Ti";
          const pricingId = map[lang] || fallback;
          return (
            <stripe-pricing-table
              pricing-table-id={pricingId}
              publishable-key={key}
              client-reference-id={uid as any}
              customer-email={email as any}
            >
            </stripe-pricing-table>
          );
        })()}
      </section>

      {/* Avis clients */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t(lang, 'reviewsTitle')}</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-4">
          {[
            { q: t(lang, 'reviews1Quote'), a: t(lang, 'reviews1Author'), r: t(lang, 'reviews1Role') },
            { q: t(lang, 'reviews2Quote'), a: t(lang, 'reviews2Author'), r: t(lang, 'reviews2Role') },
            { q: t(lang, 'reviews3Quote'), a: t(lang, 'reviews3Author'), r: t(lang, 'reviews3Role') },
          ].map((rv, i) => (
            <figure key={i} className="rounded-xl bg-white p-5 ring-1 ring-black/5">
              <blockquote className="text-sm text-neutral-700">“{rv.q}”</blockquote>
              <figcaption className="mt-3 text-xs text-neutral-500">{rv.a} · {rv.r}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      
    </div>
  );
}

// src/app/page.tsx — public landing page (concept + pricing)

export const metadata = {
  title: "RenderAnimation — Anime tes rendus 3D",
  description: "Landing page: concept, bénéfices et tarifs par crédits.",
};

export default function Page() {
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
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
              Anime tes <span className="underline decoration-black/30">rendus 3D</span> en 3 clics
            </h1>
            <p className="text-neutral-600">
              Upload → Analyse de l’image → Génération de vidéo.
              Parfait pour les promoteurs immobiliers et studios d’archi qui veulent
              animer des rendus statiques sans budget vidéo exorbitant.
            </p>
            <div className="flex gap-3 pt-1">
              <a href="/signin" className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90">
                Se connecter
              </a>
              <a href="#pricing" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                Voir les tarifs
              </a>
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

      {/* Comment ça marche */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Comment ça marche</h2>
        <div className="grid md:grid-cols-4 gap-4 text-center mt-4">
          {[
            { n: 1, t: "Upload", d: "Importez votre rendu (JPG/PNG)." },
            { n: 2, t: "Analyse", d: "L’image est analysée pour en extraire un prompt adapté." },
            { n: 3, t: "Génération", d: "Création automatique de la vidéo à partir du rendu." },
            { n: 4, t: "4K (optionnel)", d: "Upscale finale pour plus de détails et netteté." },
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
        <h2 className="text-lg font-semibold">Tarifs (abonnement)</h2>
        <p className="text-sm text-neutral-600">Crédits consommés par génération. Les crédits se renouvellent chaque mois.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { price: "25€", credits: "400 crédits / mois", cta: "S’abonner" },
            { price: "45€", credits: "800 crédits / mois", cta: "S’abonner", highlight: true },
            { price: "80€", credits: "1600 crédits / mois", cta: "S’abonner" },
          ].map((p) => (
            <div key={p.price} className={`rounded-2xl border bg-white p-6 shadow-sm ${p.highlight ? "ring-2 ring-indigo-500" : ""}`}>
              <div className="text-3xl font-semibold">{p.price}</div>
              <div className="mt-1 text-sm text-neutral-600">{p.credits}</div>
              <div className="mt-4">
                <a href="/signin" className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 w-full">
                  {p.cta}
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500">Prix HT indicatifs. Annulation à tout moment.</p>
      </section>

      {/* Accès */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Accès libre</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Cette page de présentation est accessible à tous, sans compte. Pour utiliser la plateforme, créez un compte ou connectez-vous.
        </p>
      </section>

      
    </div>
  );
}

// src/app/app/page.tsx
import UploadBox from "@/components/UploadBox";
import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 p-8 md:p-10">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            {/* Logo au-dessus du titre */}
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
              Parfait pour les promoteurs immobiliers qui souhaitent animer des rendus 3D statiques sans payer un prix exorbitant.
            </p>
          </div>
          {/* Vidéo d'exemple à droite (sans fond, légère ombre) */}
          <div className="relative">
            <video
              src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/exemple.mp4"
              className="w-full rounded-2xl shadow-sm"
              autoPlay
              loop
              muted
              playsInline
            />
            {/* Favicon en bas à gauche de la vidéo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/Favicon.png"
              alt="RenderAnimation"
              className="absolute bottom-3 left-3 h-8 w-8 rounded-md shadow-md invert-dark"
            />
          </div>
        </div>
      </section>

      <UploadBox />

      {/* 4K Upscale info */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Augmenter la résolution en 4K</h2>
        <p className="text-sm text-neutral-600 mt-2">
          Après la génération, une étape finale optionnelle permettra d’upscaler la vidéo en 4K pour une meilleure netteté.
        </p>
        <div className="mt-3 text-xs text-neutral-500">Bientôt disponible dans l’interface.</div>
      </section>
    </div>
  );
}

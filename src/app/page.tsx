// src/app/page.tsx
import UploadBox from "@/components/UploadBox";

export default function Page() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 p-8 md:p-10">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
              Anime tes <span className="underline decoration-black/30">rendus 3D</span> en 3 clics
            </h1>
            <p className="text-neutral-600">
              Upload → Analyse de l’image → Génération de vidéo.
              Parfait pour les promoteurs immobiliers qui souhaitent animer des rendus 3D statiques sans payer un prix exorbitant.
            </p>
          </div>
          {/* Stepper déplacé et dynamique dans UploadBox */}
        </div>
      </section>

      <UploadBox />
    </div>
  );
}

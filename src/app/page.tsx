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
          <div className="rounded-2xl border bg-neutral-50 p-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
                <div className="text-xl font-semibold">1</div>
                <div className="text-xs text-neutral-500 mt-1">Upload</div>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
                <div className="text-xl font-semibold">2</div>
                <div className="text-xs text-neutral-500 mt-1">Analyse</div>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
                <div className="text-xl font-semibold">3</div>
                <div className="text-xs text-neutral-500 mt-1">Vidéo Kling</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <UploadBox />
    </div>
  );
}

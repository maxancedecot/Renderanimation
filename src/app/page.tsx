// src/app/page.tsx
import UploadBox from "@/components/UploadBox";

export default function Page() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 p-8 md:p-10">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">
              Anime tes <span className="underline decoration-black/30">rendus 3D</span> en un clic
            </h1>
            <p className="text-neutral-600">
              Upload → Analyse (OpenAI) → Prompt Kling (glide avant lent) → Génération vidéo.
              Parfait pour les promoteurs immobiliers : contenus fluides, propres, sans hallucinations.
            </p>
            <ul className="text-sm text-neutral-700 space-y-2">
              <li>• Préserve <b>géométrie</b>, <b>matériaux</b> et <b>lumières</b>.</li>
              <li>• Caméra : <b>glide avant lent</b> (pas de tilt/pan/roll).</li>
              <li>• Sortie 5–10s, 16:9, 24 fps.</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-neutral-50 p-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
                <div className="text-xl font-semibold">1</div>
                <div className="text-xs text-neutral-500 mt-1">Upload</div>
              </div>
              <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
                <div className="text-xl font-semibold">2</div>
                <div className="text-xs text-neutral-500 mt-1">Analyse & Prompt</div>
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
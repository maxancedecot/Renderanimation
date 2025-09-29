// src/app/app/page.tsx
import UploadBox from "@/components/UploadBox";
import { getRequestLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const lang = getRequestLang();
  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 p-8 md:p-10">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            {/* Logo au-dessus du titre retiré */}
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{t(lang, 'heroTitle')}</h1>
            <p className="text-neutral-600">{t(lang, 'heroSub')}</p>
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
              src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/ledoux-embleem.png"
              alt="RenderAnimation"
              className="absolute bottom-3 left-3 h-8 w-8 rounded-md shadow-md"
            />
          </div>
        </div>
      </section>

      <UploadBox />

      
    </div>
  );
}

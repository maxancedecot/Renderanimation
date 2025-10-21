// src/app/layout.tsx
import "./globals.css";
import Providers from "@/components/Providers";
import HeaderNav from "@/components/HeaderNav";
import { getRequestLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { auth } from "@/src/lib/auth";

export const metadata = {
  title: "RenderAnimation",
  description: "Anime tes rendus 3D : Upload → Analyse (OpenAI) → Prompt Kling → Vidéo.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const lang = getRequestLang();
  return (
    <html lang={lang} className="h-full">
      <head>
        {/* ✅ Fallback Tailwind via CDN : les styles s’appliquent immédiatement */}
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          rel="icon"
          href="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/ledoux-embleem.png"
          type="image/png"
        />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 text-neutral-900 antialiased">
        <Providers>
          {/* Header */}
          <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
              <a href="/" className="flex items-center gap-3 group" aria-label="RenderAnimation">
                {/* Replace text logo with image logo */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/0be6fd1e-8741-4a4a-ab61-6e6accc5edc8.png"
                  alt="RenderAnimation"
                  className="h-8 w-auto"
                />
                <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 shadow-sm">
                  Beta 2.0
                </span>
              </a>
              <HeaderNav lang={lang} isAuthed={!!session?.user} />
            </div>
          </header>

          {/* Contenu */}
          <main className="mx-auto max-w-6xl px-6 py-10">
            {children}
          </main>

          {/* Footer */}
          <footer className="mt-16 border-t py-8 text-center text-sm text-neutral-500">
            {t(lang, 'footer')}
          </footer>
        </Providers>
      </body>
    </html>
  );
}

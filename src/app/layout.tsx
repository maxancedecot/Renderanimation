// src/app/layout.tsx
import "./globals.css";
import Providers from "@/components/Providers";
import ThemeToggle from "@/components/ThemeToggle";
import { auth } from "@/src/lib/auth";

export const metadata = {
  title: "RenderAnimation",
  description: "Anime tes rendus 3D : Upload → Analyse (OpenAI) → Prompt Kling → Vidéo.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="fr" className="h-full">
      <head>
        {/* ✅ Fallback Tailwind via CDN : les styles s’appliquent immédiatement */}
        <script src="https://cdn.tailwindcss.com"></script>
        {/* Set initial theme before paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('theme');
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (t === 'dark' || (!t && prefersDark)) document.documentElement.classList.add('dark');
          } catch {}
        ` }} />
        <link
          rel="icon"
          href="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/Favicon.png"
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
                  src="https://pub-60f579eb256a4570ad9e0494f23007ac.r2.dev/Favicon.png"
                  alt="RenderAnimation"
                  className="h-8 w-auto invert-dark"
                />
              </a>
              <nav className="flex items-center gap-4 text-sm text-neutral-600">
                <a href="/#pricing" className="hover:text-black">Tarifs</a>
                <a href="/upscale" className="hover:text-black">Test 4K</a>
                {session?.user ? (
                  <>
                    <a href="/app" className="hover:text-black">App</a>
                    <a href="/account" className="hover:text-black">Espace</a>
                  </>
                ) : (
                  <a href="/signin" className="hover:text-black">Connexion</a>
                )}
                <ThemeToggle />
              </nav>
            </div>
          </header>

          {/* Contenu */}
          <main className="mx-auto max-w-6xl px-6 py-10">
            {children}
          </main>

          {/* Footer */}
          <footer className="mt-16 border-t py-8 text-center text-sm text-neutral-500">
            © {new Date().getFullYear()} RenderAnimation — Propulsé par Maxance Decot 🚀
          </footer>
        </Providers>
      </body>
    </html>
  );
}

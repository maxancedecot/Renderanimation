"use client";
import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function HeaderNav({ lang, isAuthed }: { lang: Lang; isAuthed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-4 text-sm text-neutral-600">
        <a href="/#pricing" className="hover:text-black">{t(lang, 'navPricing')}</a>
        {isAuthed ? (
          <>
            <a href="/app" className="hover:text-black">{t(lang, 'navApp')}</a>
            <a href="/library" className="hover:text-black">{t(lang, 'navLibrary')}</a>
            <a href="/account" className="hover:text-black">{t(lang, 'navAccount')}</a>
          </>
        ) : (
          <a href="/signin" className="hover:text-black">{t(lang, 'navSignin')}</a>
        )}
        <LanguageSwitcher initial={lang} />
      </nav>

      {/* Mobile hamburger */}
      <button
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border bg-white hover:bg-neutral-50 text-neutral-700"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="sr-only">Menu</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile panel */}
      {open ? (
        <div className="md:hidden fixed inset-x-0 top-14 z-50 mx-3 rounded-xl border bg-white shadow-lg">
          <div className="p-3 grid gap-2 text-sm text-neutral-700">
            <a href="/#pricing" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-neutral-50">{t(lang, 'navPricing')}</a>
            {isAuthed ? (
              <>
                <a href="/app" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-neutral-50">{t(lang, 'navApp')}</a>
                <a href="/library" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-neutral-50">{t(lang, 'navLibrary')}</a>
                <a href="/account" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-neutral-50">{t(lang, 'navAccount')}</a>
              </>
            ) : (
              <a href="/signin" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-neutral-50">{t(lang, 'navSignin')}</a>
            )}
            <div className="border-t my-1"></div>
            <div className="px-3 py-1">
              <LanguageSwitcher initial={lang} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


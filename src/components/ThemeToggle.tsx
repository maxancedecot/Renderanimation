"use client";

import { useEffect, useState } from "react";

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label="Changer le thème"
      aria-pressed={isDark}
      onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
      className="relative inline-flex h-7 w-14 items-center rounded-full border transition-colors bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800 border-black/10 dark:border-white/10"
    >
      {/* Track background (sun/moon gradient hint) */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-yellow-200/30 to-blue-300/20 dark:from-zinc-800 dark:to-zinc-900" />
      {/* Knob */}
      <span
        className={[
          "relative z-10 inline-block h-5 w-5 transform rounded-full bg-black text-white transition-transform dark:bg-white dark:text-black",
          isDark ? "translate-x-7" : "translate-x-1",
        ].join(" ")}
      >
        <span className="absolute inset-0 grid place-items-center text-[11px]">
          {isDark ? "☀️" : "🌙"}
        </span>
      </span>
    </button>
  );
}

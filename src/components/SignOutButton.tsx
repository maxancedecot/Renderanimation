"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
    >
      Déconnexion
    </button>
  );
}

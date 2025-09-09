"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const p = toast.loading("Envoi de l'email…");
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await r.json().catch(() => ({}));
      toast.success("Si un compte existe, un email a été envoyé.", { id: p });
    } catch {
      toast.success("Si un compte existe, un email a été envoyé.", { id: p });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 p-6 rounded-xl bg-white shadow">
        <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
        <p className="text-sm text-neutral-600">Saisis ton email pour recevoir un lien de réinitialisation.</p>
        <input className="w-full border rounded-lg p-2" type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <button disabled={loading} className="w-full bg-black text-white rounded-lg py-2 disabled:opacity-60">Envoyer</button>
      </form>
    </div>
  );
}


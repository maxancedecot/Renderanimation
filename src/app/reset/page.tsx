"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export default function ResetPage() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { toast.error("Lien invalide"); return; }
    setLoading(true);
    const p = toast.loading("Mise à jour du mot de passe…");
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "reset failed");
      toast.success("Mot de passe mis à jour", { id: p });
      router.push("/login");
    } catch (e: any) {
      toast.error(e?.message || "Erreur de réinitialisation", { id: p });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 p-6 rounded-xl bg-white shadow">
        <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
        <input className="w-full border rounded-lg p-2" type="password" placeholder="Nouveau mot de passe (min 6 caractères)" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        <button disabled={loading || password.length < 6} className="w-full bg-black text-white rounded-lg py-2 disabled:opacity-60">Mettre à jour</button>
      </form>
    </div>
  );
}

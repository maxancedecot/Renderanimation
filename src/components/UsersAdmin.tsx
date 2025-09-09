"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type User = {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
};

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/users", { cache: "no-store" });
      if (r.status === 403) {
        setError("Accès refusé. Votre compte n'est pas autorisé.");
        setUsers([]);
        return;
      }
      const json = await r.json();
      setUsers(json.users || []);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email et mot de passe requis");
      return;
    }
    const p = toast.loading("Création utilisateur…");
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "create failed");
      toast.success("Utilisateur créé", { id: p });
      setEmail(""); setPassword(""); setName("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erreur création", { id: p });
    }
  }

  async function removeUser(id: string) {
    const p = toast.loading("Suppression…");
    try {
      const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "delete failed");
      toast.success("Utilisateur supprimé", { id: p });
      setUsers((prev) => (prev || []).filter((u) => u.id !== id));
    } catch (e: any) {
      toast.error(e?.message || "Erreur suppression", { id: p });
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Créer un utilisateur</h2>
        <form onSubmit={createUser} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input className="border rounded-lg p-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="border rounded-lg p-2" placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <input className="border rounded-lg p-2" placeholder="Nom (optionnel)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="sm:col-span-3">
            <button className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90">Ajouter</button>
          </div>
        </form>
        <p className="text-xs text-neutral-500 mt-2">Les mots de passe sont stockés hachés (scrypt).</p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Utilisateurs</h2>
          <button onClick={load} className="text-sm rounded-lg border px-3 py-1.5 hover:bg-neutral-50">Rafraîchir</button>
        </div>
        {loading && <p className="text-sm text-neutral-600 mt-3">Chargement…</p>}
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        {!loading && !error && (
          <ul className="mt-3 divide-y">
            {(users || []).map((u) => (
              <li key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-neutral-500">{u.name || "—"} · {new Date(u.createdAt).toLocaleString()}</div>
                </div>
                <button onClick={() => removeUser(u.id)} className="text-sm rounded-lg border px-3 py-1.5 hover:bg-neutral-50">Supprimer</button>
              </li>
            ))}
            {(users && users.length === 0) && <li className="py-3 text-sm text-neutral-500">Aucun utilisateur</li>}
          </ul>
        )}
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type User = {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  videosRemaining?: number;
  subscriptionStatus?: string | null;
  admin?: boolean;
};

type Props = {
  currentUserId: string;
};

export default function UsersAdmin({ currentUserId }: Props) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [grantInputs, setGrantInputs] = useState<Record<string, string>>({});
  const [granting, setGranting] = useState<Record<string, boolean>>({});
  const [adminSaving, setAdminSaving] = useState<Record<string, boolean>>({});

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
      setGrantInputs({});
      setGranting({});
      setAdminSaving({});
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
      setGrantInputs((prev) => {
        const { [id]: _omit, ...rest } = prev;
        return rest;
      });
    } catch (e: any) {
      toast.error(e?.message || "Erreur suppression", { id: p });
    }
  }

  async function grantCredits(userId: string) {
    const raw = grantInputs[userId];
    const value = Number.parseInt(raw || "", 10);
    if (!Number.isInteger(value) || value <= 0) {
      toast.error("Nombre de crédits invalide");
      return;
    }
    setGranting((prev) => ({ ...prev, [userId]: true }));
    const toastId = toast.loading("Ajout de crédits…");
    try {
      const r = await fetch(`/api/users/${userId}/grant-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "grant failed");
      const nextRemaining = typeof j?.videosRemaining === "number" ? j.videosRemaining : value;
      setUsers((prev) => (prev || []).map((u) => (u.id === userId ? { ...u, videosRemaining: nextRemaining } : u)));
      setGrantInputs((prev) => ({ ...prev, [userId]: "" }));
      toast.success(`+${value} crédits octroyés`, { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'ajout", { id: toastId });
    } finally {
      setGranting((prev) => ({ ...prev, [userId]: false }));
    }
  }

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    setAdminSaving((prev) => ({ ...prev, [userId]: true }));
    const toastId = toast.loading(makeAdmin ? "Attribution du rôle…" : "Retrait du rôle…");
    try {
      const r = await fetch(`/api/users/${userId}/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin: makeAdmin }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "admin_update_failed");
      setUsers((prev) => (prev || []).map((u) => (u.id === userId ? { ...u, admin: makeAdmin } : u)));
      toast.success(makeAdmin ? "Utilisateur promu admin" : "Rôle admin retiré", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la mise à jour", { id: toastId });
    } finally {
      setAdminSaving((prev) => ({ ...prev, [userId]: false }));
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
            {(users || []).map((u) => {
              const credits = typeof u.videosRemaining === "number" ? u.videosRemaining : 0;
              const grantValue = grantInputs[u.id] ?? "";
              const isAdmin = u.admin === true;
              return (
                <li key={u.id} className="py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium break-all">{u.email}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span>{u.name || "—"} · {new Date(u.createdAt).toLocaleString()}</span>
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          Crédits: {credits}
                        </span>
                        {isAdmin && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <form
                        onSubmit={(e) => { e.preventDefault(); grantCredits(u.id); }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="number"
                          min={1}
                          value={grantValue}
                          onChange={(e) => setGrantInputs((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          className="w-24 rounded-lg border px-2 py-1 text-sm"
                          placeholder="+ crédits"
                        />
                        <button
                          type="submit"
                          disabled={!!granting[u.id]}
                          className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
                        >
                          {granting[u.id] ? "Ajout…" : "Octroyer"}
                        </button>
                      </form>
                      <button
                        onClick={() => removeUser(u.id)}
                        className="text-sm rounded-lg border px-3 py-1.5 hover:bg-neutral-50"
                      >Supprimer</button>
                      <button
                        onClick={() => toggleAdmin(u.id, !isAdmin)}
                        disabled={!!adminSaving[u.id] || (u.id === currentUserId && isAdmin)}
                        className="text-sm rounded-lg border px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {isAdmin ? "Retirer admin" : "Rendre admin"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            {(users && users.length === 0) && <li className="py-3 text-sm text-neutral-500">Aucun utilisateur</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

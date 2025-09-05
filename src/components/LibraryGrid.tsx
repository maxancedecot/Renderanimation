"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useEffect, useMemo, useState } from "react";
import type { CreationRecord } from "@/lib/library";

async function fetchLibrary(): Promise<CreationRecord[]> {
  const r = await fetch("/api/library", { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || j?.error) throw new Error(j?.error || "fetch failed");
  return j.items as CreationRecord[];
}

export default function LibraryGrid({ initialItems }: { initialItems: CreationRecord[] }) {
  const qc = useQueryClient();
  const queryKey = ["library"] as const;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "provider_asc">("date_desc");
  const [viewer, setViewer] = useState<CreationRecord | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<string>("");
  const [editTags, setEditTags] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");

  // Seed initial data
  useEffect(() => {
    qc.setQueryData(queryKey, initialItems);
  }, [qc, initialItems]);

  const { data: items = [], isFetching } = useQuery({
    queryKey,
    queryFn: fetchLibrary,
    staleTime: 10_000,
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/library/${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) throw new Error(j?.error || "delete failed");
    },
    onSuccess: () => {
      toast.success("Supprimé de la bibliothèque");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Suppression échouée"),
  });

  const patch = useMutation({
    mutationFn: async (vars: { id: string; project?: string; tags?: string[] }) => {
      const r = await fetch(`/api/library/${encodeURIComponent(vars.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: vars.project, tags: vars.tags }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) throw new Error(j?.error || "update failed");
      return j.item as CreationRecord;
    },
    onSuccess: () => {
      toast.success("Enregistré");
      setEditingId(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message || "Mise à jour échouée"),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base0 = !term
      ? items
      : items.filter((it) => {
          const hay = [
            it.provider,
            it.prompt || "",
            new Date(it.createdAt).toLocaleString(),
            it.project || "",
            (it.tags || []).join(", "),
          ].join(" \n ").toLowerCase();
          return hay.includes(term);
        });
    const base = projectFilter ? base0.filter((x) => (x.project || "") === projectFilter) : base0;
    const sorted = [...base].sort((a, b) => {
      if (sort === "date_desc") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "date_asc") return a.createdAt.localeCompare(b.createdAt);
      // provider_asc
      const pa = a.provider.localeCompare(b.provider);
      return pa !== 0 ? pa : b.createdAt.localeCompare(a.createdAt);
    });
    return sorted;
  }, [items, search, sort, projectFilter]);

  const projects = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.project && it.project.trim()) set.add(it.project.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  async function copyLink(url: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Lien copié");
    } catch (e: any) {
      toast.error("Impossible de copier le lien");
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Rechercher… (provider, prompt)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            <option value="">Tous projets</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <label className="text-sm text-neutral-600">Trier:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            <option value="date_desc">Date (récent → ancien)</option>
            <option value="date_asc">Date (ancien → récent)</option>
            <option value="provider_asc">Provider (A → Z)</option>
          </select>
        </div>
      </div>

      {isFetching && (
        <div className="text-xs text-neutral-500">Actualisation…</div>
      )}
      {!filtered.length ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-neutral-600">
          Aucune création pour le moment. Générez une vidéo depuis l’onglet App.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((it) => (
            <div key={it.id} className="rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between mb-3 text-xs text-neutral-500">
                <span>{new Date(it.createdAt).toLocaleString()}</span>
                <span className="uppercase font-medium">{it.provider}</span>
              </div>
              {(it.project || (it.tags && it.tags.length)) && (
                <div className="mb-2 flex flex-wrap gap-2 text-xs">
                  {it.project && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 ring-1 ring-black/10">{it.project}</span>
                  )}
                  {(it.tags || []).map((t) => (
                    <span key={t} className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 ring-1 ring-indigo-200">#{t}</span>
                  ))}
                </div>
              )}
              {/* Thumbnail */}
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.imageUrl}
                  alt="aperçu"
                  className="w-full aspect-video object-cover rounded-lg ring-1 ring-black/5 bg-neutral-100"
                />
              ) : it.videoUrl ? (
                <video
                  src={it.videoUrl}
                  className="w-full aspect-video rounded-lg ring-1 ring-black/5 bg-neutral-100"
                />
              ) : (
                <div className="aspect-video grid place-items-center rounded-lg bg-neutral-100 text-neutral-500">Aperçu indisponible</div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <a
                  href={it.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-black px-3 py-1.5 text-white hover:bg-black/90 text-sm"
                >
                  Ouvrir la vidéo
                </a>
                <button
                  onClick={() => copyLink(it.videoUrl)}
                  className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 hover:bg-neutral-50 text-sm"
                >
                  Copier le lien
                </button>
                <button
                  onClick={() => {
                    if (del.isPending) return;
                    if (confirm("Supprimer cette création ?")) del.mutate(it.id);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 hover:bg-neutral-50 text-sm disabled:opacity-60"
                  disabled={del.isPending}
                >
                  {del.isPending ? "Suppression…" : "Supprimer"}
                </button>
              </div>

              {/* Edit panel */}
              <div className="mt-2">
                {editingId === it.id ? (
                  <div className="rounded-lg bg-neutral-50 p-3 ring-1 ring-black/5 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={editProject}
                        onChange={(e) => setEditProject(e.target.value)}
                        placeholder="Projet"
                        className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                      <input
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="Tags séparés par des virgules"
                        className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 hover:bg-neutral-100 text-sm"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => {
                          const tags = editTags
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean);
                          patch.mutate({ id: it.id, project: editProject.trim() || undefined, tags });
                        }}
                        disabled={patch.isPending}
                        className="inline-flex items-center justify-center rounded-lg bg-black px-3 py-1.5 text-white hover:bg-black/90 text-sm disabled:opacity-60"
                      >
                        {patch.isPending ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(it.id);
                      setEditProject(it.project || "");
                      setEditTags((it.tags || []).join(", "));
                    }}
                    className="mt-2 inline-flex items-center justify-center rounded-lg border px-3 py-1.5 hover:bg-neutral-50 text-sm"
                  >
                    Modifier projet/tags
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


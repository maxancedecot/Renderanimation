"use client";
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";

type Item = {
  id: string;
  videoUrl: string;
  title?: string;
  project?: string;
  tags?: string[];
  createdAt: string;
};

export default function LibraryGrid() {
  const qc = useQueryClient();
  const [topaz, setTopaz] = useState<Record<string, { taskId?: string; status?: string; url?: string | null; message?: string | null; saved?: boolean }>>({});
  // Debug Topaz removed
  const [is4k, setIs4k] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const r = await fetch("/api/library/list").then(r => r.json());
      if (r.error) throw new Error(r.error);
      return (r.items || []) as Item[];
    }
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/library/delete/${encodeURIComponent(id)}`, { method: "DELETE" }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      return true;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["library"] }); }
  });

  const upscale = useMutation({
    mutationFn: async (vars: { itemId: string; url: string }) => {
      // Try to read metadata client-side by loading video element
      const meta = await (async () => {
        try {
          const v = document.createElement('video');
          v.src = vars.url;
          await new Promise<void>((resolve, reject) => {
            v.onloadedmetadata = () => resolve();
            v.onerror = () => resolve();
          });
          const width = v.videoWidth;
          const height = v.videoHeight;
          const duration = isFinite(v.duration) ? v.duration : undefined;
          return { resolution: width && height ? { width, height } : undefined, duration };
        } catch { return {}; }
      })();
      const r = await fetch("/api/topaz/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputUrl: vars.url, meta }),
      }).then(r => r.json());
      if (r.error || !r.taskId) throw new Error(r.error || "taskId absent");
      return { taskId: r.taskId, itemId: vars.itemId } as { taskId: string; itemId: string };
    },
    onMutate: ({ itemId }) => {
      setTopaz((m) => ({ ...m, [itemId]: { status: "queued", url: null, message: null } }));
      toast.loading("Upscale 4K (Topaz) lancé…", { id: `tpz-${itemId}` });
    },
    onSuccess: ({ taskId, itemId }) => {
      setTopaz((m) => ({ ...m, [itemId]: { ...m[itemId], taskId, status: "queued" } }));
      toast.success("Tâche envoyée à Topaz", { id: `tpz-${itemId}` });
      // start polling
      const poll = async () => {
        try {
          const r = await fetch(`/api/topaz/status?taskId=${encodeURIComponent(taskId)}`).then(r => r.json());
          if (r.error) throw new Error(r.error);
          const status = r.status || "processing";
          const url = r.videoUrl || null;
          const message = r.message || null;
          setTopaz((m) => ({ ...m, [itemId]: { ...m[itemId], status, url, message } }));
          if (status === "failed") {
            toast.error(message || "Upscale 4K échoué", { id: `tpz-${itemId}` });
            return; // stop
          }
          if ((status === "succeeded" || status === "success") && url) {
            toast.success("Version 4K prête ✨", { id: `tpz-${itemId}` });
            // Auto-save 4K once
            const alreadySaved = !!topaz[itemId]?.saved;
            if (!alreadySaved) {
              try {
                await fetch('/api/library/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ videoUrl: url, tags: ['4k'] })
                });
                setTopaz((m) => ({ ...m, [itemId]: { ...m[itemId], saved: true } }));
                qc.invalidateQueries({ queryKey: ["library"] });
              } catch {}
            }
            return; // stop
          }
          setTimeout(poll, 5000);
        } catch (e: any) {
          toast.error(e?.message || "Erreur statu Topaz", { id: `tpz-${itemId}` });
        }
      };
      poll();
    },
    onError: (e: any, vars) => {
      if (vars?.itemId) toast.error(e?.message || "Erreur Topaz 4K", { id: `tpz-${vars.itemId}` });
    },
  });

  // Debug Topaz removed

  if (isLoading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur: {(error as any)?.message}</p>;
  const items = data || [];
  if (items.length === 0) return <p>Aucune vidéo enregistrée pour le moment.</p>;

  return (
    <div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map(it => (
        <div key={it.id} className="relative rounded-xl border bg-white p-4 shadow-sm">
          <div className="aspect-video rounded-lg overflow-hidden ring-1 ring-black/5 relative">
            <video
              src={it.videoUrl}
              controls
              className="w-full h-full object-cover"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget as HTMLVideoElement;
                const w = v.videoWidth, h = v.videoHeight;
                const is = w >= 3840 || h >= 2160;
                setIs4k((m) => ({ ...m, [it.id]: is }));
              }}
            />
            {(is4k[it.id] || (it.tags || []).includes('4k')) && (
              <span className="absolute top-2 left-2 rounded-md bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-800 ring-1 ring-green-300 shadow-sm">
                4K
              </span>
            )}
            <button
              aria-label="Supprimer"
              className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100/70 text-white hover:bg-rose-200/80 ring-1 ring-rose-300 shadow-sm text-xs"
              onClick={() => setConfirmDelete({ id: it.id })}
              title="Supprimer"
            >
              ×
            </button>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <a
                href={it.videoUrl}
                download
                className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 whitespace-nowrap"
              >Télécharger</a>
              {!(is4k[it.id] || (it.tags || []).includes('4k')) && (
                <button
                  onClick={() => upscale.mutate({ itemId: it.id, url: it.videoUrl })}
                  className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50 disabled:opacity-60 whitespace-nowrap"
                  disabled={!!topaz[it.id]?.taskId || upscale.isPending}
                  title="Upscale 4K"
                >{topaz[it.id]?.taskId ? "4K en cours…" : "Upscale 4K"}</button>
              )}
            </div>
          </div>
            {/* Debug Topaz panel removed */}
            {!!topaz[it.id]?.status && (
              <div className="mt-2 text-xs text-neutral-600">{`Topaz 4K: ${topaz[it.id]?.status}`}{topaz[it.id]?.message ? ` — ${topaz[it.id]?.message}` : ''}</div>
            )}
            {!!topaz[it.id]?.url && (
              <div className="mt-2">
                <a
                  href={topaz[it.id]?.url || undefined}
                  download
                  className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90"
                >Télécharger 4K</a>
              </div>
            )}
            {it.project && <div className="mt-1 text-xs text-neutral-600">Projet: {it.project}</div>}
            {!!it.tags?.length && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {it.tags.map(t => (
                  <span key={t} className="text-[10px] rounded bg-neutral-100 px-2 py-0.5 text-neutral-700 ring-1 ring-black/5">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
    {confirmDelete && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
          <h3 className="text-lg font-semibold">Confirmer la suppression</h3>
          <p className="mt-2 text-sm text-neutral-600">Êtes-vous sûr de vouloir supprimer la vidéo ? Cette action est irréversible.</p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50"
              onClick={() => setConfirmDelete(null)}
              disabled={del.isPending}
            >Non</button>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-600/90 disabled:opacity-60"
              onClick={() => { if (confirmDelete) { del.mutate(confirmDelete.id); setConfirmDelete(null); } }}
              disabled={del.isPending}
            >Oui</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

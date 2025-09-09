"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

  if (isLoading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur: {(error as any)?.message}</p>;
  const items = data || [];
  if (items.length === 0) return <p>Aucune vidéo enregistrée pour le moment.</p>;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map(it => (
        <div key={it.id} className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="aspect-video rounded-lg overflow-hidden ring-1 ring-black/5">
            <video src={it.videoUrl} controls className="w-full h-full object-cover" />
          </div>
          <div className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-neutral-500">{new Date(it.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={it.videoUrl}
                  download
                  className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90"
                >Télécharger</a>
                <button
                  onClick={() => del.mutate(it.id)}
                  className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50"
                  disabled={del.isPending}
                  title="Supprimer"
                >Supprimer</button>
              </div>
            </div>
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
  );
}

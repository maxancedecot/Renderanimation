"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getClientLang, t } from "@/lib/i18n";

type Item = {
  id: string;
  videoUrl: string;
  title?: string;
  project?: string;
  tags?: string[];
  createdAt: string;
  folderId?: string;
};

export default function LibraryGrid() {
  const qc = useQueryClient();
  const lang = getClientLang();
  const [topaz, setTopaz] = useState<Record<string, { taskId?: string; status?: string; url?: string | null; message?: string | null; saved?: boolean }>>({});
  // Debug Topaz removed
  const [is4k, setIs4k] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ id: string } | null>(null);
  const [topazStart, setTopazStart] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string | "all">('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const r = await fetch("/api/library/list").then(r => r.json());
      if (r.error) throw new Error(r.error);
      return (r.items || []) as Item[];
    }
  });
  const { data: folderData } = useQuery({
    queryKey: ["libraryFolders"],
    queryFn: async () => {
      const r = await fetch("/api/library/folders").then(r => r.json());
      if (r.error) throw new Error(r.error);
      return (r.folders || []) as Array<{ id: string; name: string; createdAt: string }>;
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
      toast.loading(t(lang, 'toast4kStart'), { id: `tpz-${itemId}` });
      setTopazStart((s) => ({ ...s, [itemId]: Date.now() }));
    },
    onSuccess: ({ taskId, itemId }) => {
      setTopaz((m) => ({ ...m, [itemId]: { ...m[itemId], taskId, status: "queued" } }));
      toast.success(t(lang, 'toast4kReceived'), { id: `tpz-${itemId}` });
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
            toast.error(message || t(lang, 'toast4kFailed'), { id: `tpz-${itemId}` });
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
          toast.error(e?.message || t(lang, 'toast4kError'), { id: `tpz-${itemId}` });
        }
      };
      poll();
    },
    onError: (e: any, vars) => {
      const id = vars?.itemId;
      const msg = String(e?.message || '');
      if (!id) return;
      if (msg === 'subscription_required') {
        toast.error(`${t(lang,'errSubRequired')} — ${t(lang,'hintSeePlans')}`, { id: `tpz-${id}` });
      } else if (msg === 'fourk_not_included') {
        toast.error(`${t(lang,'err4kNotIncluded')} — ${t(lang,'hintManageSubscription')}`, { id: `tpz-${id}` });
      } else {
        toast.error(msg || t(lang, 'toast4kError'), { id: `tpz-${id}` });
      }
    },
  });

  // Debug Topaz removed

  // Global ticker for indicative progress refresh when any task in progress
  useEffect(() => {
    const inProgress = Object.values(topaz).some((v) => v?.taskId && !v?.url);
    if (!inProgress) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [topaz]);

  function computeProgress(itemId: string): number {
    const start = topazStart[itemId];
    if (!start) return 0;
    const elapsed = Date.now() - start;
    const maxMs = 12 * 60 * 1000;
    return Math.min(95, (elapsed / maxMs) * 85 + 8);
  }

  function ProgressBar({ percent }: { percent: number }) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    return (
      <div className="w-full h-2 rounded bg-neutral-200">
        <div className="h-2 rounded bg-green-400/80 transition-all" style={{ width: `${p}%` }} />
      </div>
    );
  }

  if (isLoading) return <p>{t(lang, 'loading')}</p>;
  if (error) return <p className="text-red-600">{t(lang, 'errorPrefix')} {(error as any)?.message}</p>;
  const items = data || [];
  const folders = folderData || [];
  const filtered = selectedFolder === 'all' ? items : items.filter(it => it.folderId === selectedFolder);
  if (items.length === 0) return <p>{t(lang, 'emptyLibrary')}</p>;

  return (
    <div>
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-600">{t(lang, 'folderLabel')}</label>
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value as any)}
        >
          <option value="all">{t(lang, 'all')}</option>
          {folders.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
        </select>
        <button
          className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
          disabled={selectedFolder === 'all'}
          onClick={() => { if (selectedFolder !== 'all') setConfirmDeleteFolder(selectedFolder); }}
        >{t(lang, 'deleteFolder')}</button>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder={t(lang, 'newFolderPlaceholder')}
          className="rounded-md border px-2 py-1 text-sm"
        />
        <button
          className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
          onClick={async () => {
            const name = newFolderName.trim();
            if (!name) return;
            // client-side duplicate prevention
            if (folders.some(f => f.name.trim().toLowerCase() === name.toLowerCase())) {
              toast.error('Un dossier avec ce nom existe déjà');
              return;
            }
            const r = await fetch('/api/library/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r=>r.json());
            if (r.error) return toast.error(r.error);
            setNewFolderName('');
            qc.invalidateQueries({ queryKey: ['libraryFolders'] });
          }}
        >{t(lang, 'create')}</button>
      </div>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((it) => {
          const show4k = is4k[it.id] || (it.tags || []).includes('4k');
          return (
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
                {show4k ? (
                  <span className="absolute bottom-2 right-2 rounded-md bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-800 ring-1 ring-green-300 shadow-sm">4K</span>
                ) : null}
                <button
                  aria-label={t(lang, 'deleteTooltip')}
                  className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-100/70 text-white hover:bg-rose-200/80 ring-1 ring-rose-300 shadow-sm text-xs"
                  onClick={() => setConfirmDelete({ id: it.id })}
                  title={t(lang, 'deleteTooltip')}
                >
                  ×
                </button>
              </div>
              <div className="mt-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <a
                      href={it.videoUrl}
                      download
                      className="inline-flex items-center justify-center rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-black/85 whitespace-nowrap shadow-sm"
                    >
                      {t(lang, 'download')}
                    </a>
                    {!show4k ? (
                      <button
                        onClick={() => upscale.mutate({ itemId: it.id, url: it.videoUrl })}
                        className="inline-flex items-center justify-center rounded-md bg-[#F9D83C] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#F9D83C]/90 disabled:opacity-60 whitespace-nowrap shadow-sm"
                        disabled={!!topaz[it.id]?.taskId || upscale.isPending}
                        title={t(lang, 'upscale4k')}
                      >
                        {topaz[it.id]?.taskId ? t(lang, 'fourkPending') : t(lang, 'upscale4k')}
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <select
                      className="rounded-md border px-2 py-2 text-sm"
                      value={it.folderId || ''}
                      onChange={async (e) => {
                        const folderId = e.target.value || undefined;
                        const r = await fetch('/api/library/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: it.id, folderId }) }).then(r=>r.json());
                        if (r?.error) return toast.error(r.error);
                        qc.invalidateQueries({ queryKey: ['library'] });
                      }}
                    >
                      <option value=''>{t(lang, 'noFolder')}</option>
                      {folders.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                    </select>
                  </div>
                </div>
              </div>
              {!!topaz[it.id]?.status ? (
                <div className="mt-2">
                  {!!topaz[it.id]?.taskId && !topaz[it.id]?.url ? (
                    <>
                      <ProgressBar percent={computeProgress(it.id)} />
                      <div className="mt-1 text-xs text-neutral-600">
                        {(() => {
                          const s = topaz[it.id]?.status;
                          const m = topaz[it.id]?.message;
                          if (s === 'processing' || s === 'queued') {
                            return t(lang, 'ra4kInProgress');
                          }
                          return `RA 4K: ${s}${m ? ` — ${m}` : ''}`;
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-neutral-600">
                      {(() => {
                        const s = topaz[it.id]?.status;
                        const m = topaz[it.id]?.message;
                        if (s === 'processing' || s === 'queued') {
                          return t(lang, 'ra4kInProgress');
                        }
                        return `RA 4K: ${s}${m ? ` — ${m}` : ''}`;
                      })()}
                    </div>
                  )}
                </div>
              ) : null}
              {/* Removed extra 4K download link under buttons */}
              {it.project ? (<div className="mt-1 text-xs text-neutral-600">{t(lang, 'projectLabel')} {it.project}</div>) : null}
              {!!it.tags?.length ? (
                <div className="mt-2 flex gap-1 flex-wrap">
                  {it.tags.map((t) => (
                    <span key={t} className="text-[10px] rounded bg-neutral-100 px-2 py-0.5 text-neutral-700 ring-1 ring-black/5">{t}</span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
            <h3 className="text-lg font-semibold">{t(lang, 'confirmDeleteTitle')}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t(lang, 'confirmDeleteBody')}</p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50"
                onClick={() => setConfirmDelete(null)}
                disabled={del.isPending}
              >
                {t(lang, 'no')}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-600/90 disabled:opacity-60"
                onClick={() => { if (confirmDelete) { del.mutate(confirmDelete.id); setConfirmDelete(null); } }}
                disabled={del.isPending}
              >
                {t(lang, 'yes')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDeleteFolder ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
            <h3 className="text-lg font-semibold">{t(lang, 'deleteFolderTitle')}</h3>
            <p className="mt-2 text-sm text-neutral-600">{t(lang, 'deleteFolderBody')}</p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50"
                onClick={() => setConfirmDeleteFolder(null)}
              >
                Non
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-600/90 disabled:opacity-60"
                onClick={async () => {
                  const id = confirmDeleteFolder;
                  setConfirmDeleteFolder(null);
                  if (!id) return;
                  const r = await fetch(`/api/library/folders/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r=>r.json());
                  if (r?.error) return toast.error(r.error);
                  setSelectedFolder('all');
                  qc.invalidateQueries({ queryKey: ['libraryFolders'] });
                  qc.invalidateQueries({ queryKey: ['library'] });
                }}
              >
                Oui
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

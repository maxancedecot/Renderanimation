"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type TopazStatus = { status?: string; message?: string | null; videoUrl?: string | null };

export default function UpscaleTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const statusKey = useMemo(() => ["topazStatus", taskId], [taskId]);

  async function uploadToR2(f: File): Promise<string> {
    const p = toast.loading("Signature…");
    try {
      const sign = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: f.name, contentType: f.type || "video/mp4" })
      }).then(r => r.json());
      if (!sign?.uploadUrl || !sign?.publicUrl) throw new Error(sign?.error || "signature invalide");
      toast.loading("Upload vers R2…", { id: p });
      const putRes = await fetch(sign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": f.type || "video/mp4" },
        body: f
      });
      if (!putRes.ok) {
        const txt = await putRes.text().catch(() => "");
        throw new Error(`R2 PUT failed: ${putRes.status} ${putRes.statusText} ${txt}`);
      }
      toast.success("Vidéo uploadée ✅", { id: p });
      return String(sign.publicUrl);
    } catch (e: any) {
      toast.error(e?.message || "Échec upload", { id: p });
      throw e;
    }
  }

  async function startUpscale() {
    try {
      if (!file) throw new Error("Aucun fichier vidéo");
      if (!file.type.startsWith("video/")) throw new Error("Sélectionne un fichier vidéo (mp4, mov…)");
      setResultUrl(null);
      setTaskId(null);
      // 1) Upload
      const publicUrl = await uploadToR2(file);
      setSrcUrl(publicUrl);
      // 2) Topaz
      const p2 = toast.loading("Upscale 4K en cours…");
      const r = await fetch("/api/topaz/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: publicUrl })
      }).then(r => r.json());
      if (r.error || !r.taskId) throw new Error(r.error || "taskId absent");
      setTaskId(r.taskId);
      toast.success("Tâche envoyée à Topaz", { id: p2 });
    } catch (e: any) {
      toast.error(e?.message || "Erreur 4K");
    }
  }

  // Simple polling without react-query to keep page self-contained
  useEffect(() => {
    if (!taskId) return;
    let timer: any;
    let mounted = true;
    const poll = async () => {
      try {
        const st: TopazStatus = await fetch(`/api/topaz/status?taskId=${encodeURIComponent(taskId)}`).then(r => r.json());
        if (!mounted) return;
        if (st.status === "failed") {
          toast.error(st.message || "Upscale 4K échoué");
          setTaskId(null);
          return;
        }
        if (st.status === "succeed" && st.videoUrl) {
          toast.success("Vidéo 4K prête ✨");
          setResultUrl(st.videoUrl);
          setTaskId(null);
          return;
        }
      } catch (e: any) {
        // keep polling; error may be transient
      }
      timer = setTimeout(poll, 5000);
    };
    poll();
    return () => { mounted = false; clearTimeout(timer); };
  }, [taskId]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Test — Upscale 4K direct</h1>
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-600">Charge une vidéo (mp4/mov), on l’envoie vers Topaz pour un upscale 4K.</p>
        <div className="mt-4 flex items-center gap-3">
          <input type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button
            className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60"
            onClick={startUpscale}
            disabled={!file || !!taskId}
          >
            {taskId ? "4K en cours…" : "Lancer l’upscale 4K"}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Original</h2>
          {!srcUrl ? (
            <p className="text-sm text-neutral-600 mt-2">Aucune vidéo pour le moment.</p>
          ) : (
            <video src={srcUrl} controls className="mt-4 w-full rounded-xl ring-1 ring-black/5" />
          )}
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Version 4K</h2>
          {!resultUrl ? (
            <p className="text-sm text-neutral-600 mt-2">La vidéo 4K apparaîtra ici.</p>
          ) : (
            <video src={resultUrl} controls className="mt-4 w-full rounded-xl ring-1 ring-black/5" />
          )}
        </div>
      </div>
    </div>
  );
}


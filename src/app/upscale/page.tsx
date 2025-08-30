"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

type TopazStatus = { status?: string; message?: string | null; videoUrl?: string | null };

function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full h-2 rounded bg-neutral-200 dark:bg-neutral-800">
      <div className="h-2 rounded bg-indigo-600 transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

export default function UpscaleTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

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
      // Use XHR to track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", sign.uploadUrl, true);
        xhr.setRequestHeader("Content-Type", f.type || "video/mp4");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress((ev.loaded / ev.total) * 100);
          }
        };
        xhr.onerror = () => reject(new Error("XHR upload error"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 PUT failed: ${xhr.status} ${xhr.statusText}`));
        };
        xhr.send(f);
      });
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
      // Basic checks
      const MAX_SIZE_MB = 300; // ajustable
      const MAX_DURATION_S = 120; // ajustable
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > MAX_SIZE_MB) {
        throw new Error(`Fichier trop volumineux (${sizeMB.toFixed(0)}MB). Limite ${MAX_SIZE_MB}MB.`);
      }
      if (durationSec && durationSec > MAX_DURATION_S) {
        throw new Error(`Vidéo trop longue (${Math.round(durationSec)}s). Limite ${MAX_DURATION_S}s.`);
      }
      setResultUrl(null);
      setTaskId(null);
      setUploadProgress(0);
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

  // Read duration when file changes
  useEffect(() => {
    setDurationSec(null);
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      v.onloadedmetadata = () => {
        setDurationSec(v.duration || null);
        URL.revokeObjectURL(url);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
      };
    } catch {
      // ignore
    }
  }, [file]);

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
        {file && (
          <div className="mt-3 text-xs text-neutral-600">
            <div>Fichier: <b>{file.name}</b> · {(file.size/(1024*1024)).toFixed(1)} MB {durationSec ? `· ${Math.round(durationSec)}s` : ""}</div>
          </div>
        )}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-3">
            <ProgressBar percent={uploadProgress} />
            <div className="mt-1 text-xs text-neutral-600">Upload: {Math.round(uploadProgress)}%</div>
          </div>
        )}
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

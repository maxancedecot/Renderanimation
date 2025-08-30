"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

/* Helpers */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.substring(res.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full h-2 rounded bg-neutral-200">
      <div className="h-2 rounded bg-indigo-600 transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

export default function UploadBox() {
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | null>(null);       // image originale OU nettoyée
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);   // image sans personnes
  const [result, setResult] = useState<any>(null);

  const [klingTaskId, setKlingTaskId] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  /* Drag & drop */
  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setIsDragging(false), []);

  /* Indicative progress while Kling pending */
  useEffect(() => {
    if (!klingTaskId) return;
    let mounted = true;
    const start = Date.now();
    const maxMs = 10 * 60 * 1000;
    const tick = () => {
      if (!mounted) return;
      const elapsed = Date.now() - start;
      const v = Math.min(95, (elapsed / maxMs) * 85 + 8);
      setProgress(v);
      if (klingTaskId) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(id); };
  }, [klingTaskId]);

  /* 1) Upload (R2) + analyse */
  const uploadAndAnalyze = useMutation({
    mutationFn: async (file: File) => {
      const sign = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      }).then(r => r.json());
      if (sign?.error || !sign.uploadUrl || !sign.publicUrl) {
        throw new Error(sign?.error || "Signature invalide");
      }
      const putRes = await fetch(sign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
      if (!putRes.ok) {
        const txt = await putRes.text().catch(() => "");
        throw new Error(`R2 PUT failed: ${putRes.status} ${putRes.statusText} ${txt}`);
      }
      const imagePublicUrl: string = sign.publicUrl;

      // On ne lance PAS l'analyse tout de suite — car on veut potentiellement retirer les personnes d'abord.
      return { imagePublicUrl };
    },
    onMutate: () => {
      setResult(null);
      setImageUrl(null);
      setCleanedUrl(null);
      setFinalVideoUrl(null);
      setKlingTaskId(null);
      setProgress(0);
      toast.loading("Upload en cours…", { id: "ua" });
    },
    onSuccess: (data) => {
      setImageUrl(data.imagePublicUrl);
      toast.success("Image uploadée ✅", { id: "ua" });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erreur d’upload", { id: "ua" });
    }
  });

  /* 1.b) Retirer les personnes (OpenAI) */
  const removePeople = useMutation({
    mutationFn: async () => {
      if (!imageUrl && !file) throw new Error("Aucune image disponible");
      let imageDataUrl: string | undefined;
      if (!imageUrl && file) {
        const b64 = await fileToBase64(file);
        imageDataUrl = `data:${file.type};base64,${b64}`;
      }
      const r = await fetch("/api/images/remove-people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageUrl || undefined,
          imageDataUrl
        })
      }).then(r => r.json());
      if (r.error || !r.cleanedUrl) throw new Error(r.error || "Nettoyage échoué");
      return r.cleanedUrl as string;
    },
    onMutate: () => {
      toast.loading("Suppression des personnes…", { id: "rp" });
      setCleanedUrl(null);
      setResult(null);
    },
    onSuccess: (url) => {
      setCleanedUrl(url);
      setImageUrl(url); // on bascule sur l’image nettoyée
      toast.success("Personnes retirées ✅", { id: "rp" });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur suppression", { id: "rp" })
  });

  /* 2) Analyse + prompt (sur l’image actuelle : nettoyée si dispo) */
  const runAnalyze = useMutation({
    mutationFn: async () => {
      if (!imageUrl) throw new Error("Pas d'image disponible");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl })
      }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      return res;
    },
    onMutate: () => {
      toast.loading("Analyse en cours…", { id: "an" });
      setResult(null);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("Analyse OK ✅", { id: "an" });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur analyse", { id: "an" })
  });

  /* 3) Soumettre à Kling (génération) */
  const createKling = useMutation({
    mutationFn: async ({ prompt }: { prompt: string }) => {
      if (!imageUrl && !file) throw new Error("Aucune image dispo");
      // N'envoie PAS de base64 si on a déjà une URL publique (évite FUNCTION_PAYLOAD_TOO_LARGE)
      let imageDataUrl: string | undefined;
      if (!imageUrl && file) {
        const b64 = await fileToBase64(file);
        imageDataUrl = `data:${file.type};base64,${b64}`;
      }
      // Priorité à l'URL publique (imageUrl pointe déjà vers l’image nettoyée si le bouton a été utilisé)
      const r = await fetch("/api/kling/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, imageDataUrl, prompt, durationSec: 5 })
      }).then(r => r.json());
      if (r.error || !r.taskId) throw new Error(r.error || "taskId absent");
      return r.taskId as string;
    },
    onMutate: () => {
      toast.loading("Tâche Kling soumise…", { id: "kg" });
      setKlingTaskId(null);
      setFinalVideoUrl(null);
      setProgress(0);
    },
    onSuccess: (taskId) => {
      setKlingTaskId(taskId);
      toast.success("Kling a bien reçu la tâche", { id: "kg" });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur Kling", { id: "kg" })
  });

  /* 4) Poll Kling */
  const statusQueryKey = useMemo(() => ["klingStatus", klingTaskId], [klingTaskId]);
  const { data: statusData } = useQuery({
    queryKey: statusQueryKey,
    enabled: !!klingTaskId,
    queryFn: async () => {
      const r = await fetch(`/api/kling/status?taskId=${encodeURIComponent(klingTaskId!)}`).then(r => r.json());
      if (r.error) throw new Error(r.error);
      return r as { status?: string; videoUrl?: string | null; message?: string | null };
    },
    refetchInterval: 4000,
    retry: false,
  });

  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === "failed") {
      toast.error(statusData.message || "Kling a échoué", { id: "ks" });
      setKlingTaskId(null);
      setProgress(0);
      qc.removeQueries({ queryKey: statusQueryKey });
    } else if (statusData.status === "succeed" && statusData.videoUrl) {
      toast.success("Vidéo prête ✨", { id: "ks" });
      setFinalVideoUrl(statusData.videoUrl);
      setKlingTaskId(null);
      setProgress(100);
      qc.removeQueries({ queryKey: statusQueryKey });
      const el = document.getElementById("kling-video");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [statusData, qc, statusQueryKey]);

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Étapes (progression) */}
      <div className="rounded-2xl border bg-neutral-50 p-6 lg:col-span-2">
        {(() => {
          const step1Done = !!imageUrl; // après upload (ou nettoyage)
          const step2Done = !!result;   // après analyse OK
          const step3Done = !!finalVideoUrl; // vidéo prête

          const step1Active = uploadAndAnalyze.isPending && !step1Done;
          const step2Active = runAnalyze.isPending && !step2Done;
          const step3Active = (createKling.isPending || !!klingTaskId) && !step3Done;

          const boxClass = (done: boolean, active: boolean) =>
            [
              "rounded-xl p-4 ring-1 text-center transition",
              done && "bg-green-50 ring-green-200 text-green-700",
              !done && active && "bg-indigo-50 ring-indigo-200 text-indigo-700",
              !done && !active && "bg-white ring-black/10 text-neutral-500"
            ].filter(Boolean).join(" ");

          const numClass = (done: boolean, active: boolean) =>
            [
              "text-xl font-semibold",
              done && "text-green-700",
              active && !done && "text-indigo-700",
              !done && !active && "text-neutral-800"
            ].filter(Boolean).join(" ");

          return (
            <div className="grid grid-cols-3 gap-3">
              <div className={boxClass(step1Done, step1Active)}>
                <div className={numClass(step1Done, step1Active) + " step-number"}>1</div>
                <div className="text-xs mt-1">Upload</div>
              </div>
              <div className={boxClass(step2Done, step2Active)}>
                <div className={numClass(step2Done, step2Active) + " step-number"}>2</div>
                <div className="text-xs mt-1">Analyse</div>
              </div>
              <div className={boxClass(step3Done, step3Active)}>
                <div className={numClass(step3Done, step3Active) + " step-number"}>3</div>
                <div className="text-xs mt-1">Génération de vidéo</div>
              </div>
            </div>
          );
        })()}
      </div>
      {/* Colonne gauche : Upload + Nettoyage + Analyse + Kling */}
      <div className="space-y-6">
        {/* Upload */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Uploader un rendu 3D</h2>
          <p className="text-sm text-neutral-600 mt-1">Formats JPG/PNG</p>

          <label
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={clsx(
              "mt-4 block rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer",
              "bg-neutral-50 hover:bg-neutral-100",
              "border-neutral-300 dark:border-neutral-700",
              isDragging && "border-indigo-500 bg-indigo-50"
            )}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <div className="text-sm text-neutral-600">
              {file ? (
                <span className="font-medium text-black dark:text-white">{file.name}</span>
              ) : (
                <>Glisse ton image ou <span className="underline">clique pour parcourir</span></>
              )}
            </div>
          </label>

          <div className="mt-4 flex gap-3">
            <button
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-600/90 disabled:opacity-60"
              onClick={() => file && uploadAndAnalyze.mutate(file)}
              disabled={!file || uploadAndAnalyze.isPending}
            >
              {uploadAndAnalyze.isPending ? "Upload…" : "Uploader"}
            </button>
            <button
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50 disabled:opacity-50"
              onClick={() => { setFile(null); setImageUrl(null); setCleanedUrl(null); setResult(null); setFinalVideoUrl(null); }}
              disabled={uploadAndAnalyze.isPending}
            >
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Nettoyage personnes + Analyse + Kling */}
        {imageUrl && (
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Préparation</h2>

            {!result && (
              <div className="flex flex-wrap gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-600/90 disabled:opacity-60"
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={removePeople.isPending}
                >
                  {removePeople.isPending ? "Retrait des personnes…" : "Retirer les personnes"}
                </button>

                <button
                  className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60"
                  onClick={() => runAnalyze.mutate()}
                  disabled={runAnalyze.isPending}
                >
                  {runAnalyze.isPending ? "Analyse…" : "Analyser l’image"}
                </button>
              </div>
            )}

            {result && (
              <>
                <h3 className="font-semibold">Image analysée — prête à être animée</h3>
                <p className="text-sm text-neutral-600">Clique sur Générer la vidéo pour lancer l’animation.</p>
                <div className="flex gap-2">
                  <button
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-600/90 disabled:opacity-60"
                    onClick={() => createKling.mutate({ prompt: result.prompt })}
                    disabled={createKling.isPending || !!klingTaskId}
                  >
                    {createKling.isPending ? "Démarrage…" : (!!klingTaskId ? "En cours…" : "Générer la vidéo")}
                  </button>
                </div>
              </>
            )}

            {!!klingTaskId && (
              <div className="space-y-2 pt-2">
                <ProgressBar percent={progress} />
                <p className="text-sm text-neutral-600">
                  {`Tâche Kling: ${statusData?.status || "envoi…"}`}
                </p>
                {statusData?.message && <p className="text-xs text-neutral-500">{statusData.message}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Colonne droite : aperçu + vidéo */}
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Aperçu</h2>
          {!imageUrl ? (
            <p className="text-sm text-neutral-600 mt-2">Aucune image pour le moment.</p>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="upload"
                className="mt-4 w-full max-h-[420px] object-contain rounded-xl ring-1 ring-black/5"
              />
            </>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Vidéo générée</h2>
          {!finalVideoUrl ? (
            <p className="text-sm text-neutral-600 mt-2">La vidéo apparaîtra ici une fois prête.</p>
          ) : (
            <video id="kling-video" src={finalVideoUrl} controls className="mt-4 w-full rounded-xl ring-1 ring-black/5" />
          )}
        </div>

        {finalVideoUrl && (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Augmenter la résolution en 4K</h2>
            <p className="text-sm text-neutral-600 mt-2">
              Étape finale (optionnelle) après la génération: améliore la netteté et les détails pour une diffusion grand écran.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white opacity-70 cursor-not-allowed"
                disabled
                title="Bientôt disponible"
              >
                Augmenter en 4K (bientôt)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmation: retirer les personnes */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
            <h3 className="text-lg font-semibold">Retirer les personnes ?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Cette opération peut modifier le ratio de l’image nettoyée. Veux-tu continuer ?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={removePeople.isPending}
              >
                Annuler
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-600/90 disabled:opacity-60"
                onClick={() => { setShowRemoveConfirm(false); removePeople.mutate(); }}
                disabled={removePeople.isPending}
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

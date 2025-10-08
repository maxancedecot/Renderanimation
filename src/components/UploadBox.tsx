"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getClientLang, t } from "@/lib/i18n";
import type { CameraMotion } from "@/lib/klingPrompt";

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
  const lang = getClientLang();

  // Billing credits for badge near Generate
  const { data: billingData } = useQuery({
    queryKey: ['billingMe'],
    queryFn: async () => {
      const r = await fetch('/api/billing/me');
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 10000,
  });
  const creditsBadge = (() => {
    const b = (billingData as any)?.billing;
    if (!b || typeof b.videosRemaining !== 'number') return null;
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700" title={t(lang,'credits')}>
        {t(lang,'credits')}: {b.videosRemaining}
      </span>
    );
  })();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | null>(null);       // image originale OU nettoyée
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);   // image sans personnes
  const [result, setResult] = useState<any>(null);

  const [klingTaskId, setKlingTaskId] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [cameraMotion, setCameraMotion] = useState<CameraMotion>('forward_push');
  

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
      toast.loading(t(lang, 'toastUploading'), { id: "ua" });
    },
    onSuccess: (data) => {
      setImageUrl(data.imagePublicUrl);
      toast.success(t(lang, 'toastUploaded'), { id: "ua" });
    },
    onError: (e: any) => {
      toast.error(e?.message || t(lang, 'toastUploadError'), { id: "ua" });
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
      toast.loading(t(lang, 'toastRemoving'), { id: "rp" });
      setCleanedUrl(null);
      setResult(null);
    },
    onSuccess: (url) => {
      setCleanedUrl(url);
      setImageUrl(url); // on bascule sur l’image nettoyée
      toast.success(t(lang, 'toastRemoved'), { id: "rp" });
    },
    onError: (e: any) => toast.error(e?.message || t(lang, 'toastRemoveError'), { id: "rp" })
  });

  /* 2) Analyse + prompt (sur l’image actuelle : nettoyée si dispo) */
  const cameraOptionLabels: Record<CameraMotion, string> = {
    orbit_left: t(lang, 'cameraOptionOrbitLeftTitle'),
    forward_push: t(lang, 'cameraOptionForwardPushTitle'),
    orbit_right: t(lang, 'cameraOptionOrbitRightTitle'),
  } as const;
  const cameraOptionDescriptions: Record<CameraMotion, string> = {
    orbit_left: t(lang, 'cameraOptionOrbitLeftDesc'),
    forward_push: t(lang, 'cameraOptionForwardPushDesc'),
    orbit_right: t(lang, 'cameraOptionOrbitRightDesc'),
  } as const;
  const cameraOptions: Array<{ value: CameraMotion; label: string; description: string }> = [
    { value: 'orbit_left', label: cameraOptionLabels.orbit_left, description: cameraOptionDescriptions.orbit_left },
    { value: 'forward_push', label: cameraOptionLabels.forward_push, description: cameraOptionDescriptions.forward_push },
    { value: 'orbit_right', label: cameraOptionLabels.orbit_right, description: cameraOptionDescriptions.orbit_right },
  ];

  const runAnalyze = useMutation<
    { analysis: any; prompt: string; cameraMotion?: CameraMotion },
    any,
    { cameraMotion: CameraMotion }
  >({
    mutationFn: async ({ cameraMotion }) => {
      if (!imageUrl) throw new Error("Pas d'image disponible");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, cameraMotion })
      }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      return res;
    },
    onMutate: () => {
      toast.loading(t(lang, 'toastAnalyzing'), { id: "an" });
      setResult(null);
    },
    onSuccess: (data, variables) => {
      setResult({ ...data, cameraMotion: variables.cameraMotion });
      toast.success(t(lang, 'toastAnalyzed'), { id: "an" });
    },
    onError: (e: any) => toast.error(e?.message || t(lang, 'toastAnalyzeError'), { id: "an" })
  });

  /* 3) Soumettre (Kling) */
  const createKling = useMutation<{ taskId: string }, any, { prompt: string }>({
    mutationFn: async ({ prompt }: { prompt: string }) => {
      if (!imageUrl && !file) throw new Error("Aucune image dispo");
      // N'envoie PAS de base64 si on a déjà une URL publique (évite FUNCTION_PAYLOAD_TOO_LARGE)
      let imageDataUrl: string | undefined;
      if (!imageUrl && file) {
        const b64 = await fileToBase64(file);
        imageDataUrl = `data:${file.type};base64,${b64}`;
      }
      const r = await fetch("/api/kling/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, imageDataUrl, prompt, durationSec: 5 })
      }).then(r => r.json());
      if (r.error || !r.taskId) throw new Error(r.error || "taskId absent");
      return { taskId: r.taskId as string };
    },
    onMutate: () => {
      toast.loading(t(lang, 'toastTaskSubmitted'), { id: "kg" });
      setKlingTaskId(null);
      setFinalVideoUrl(null);
      setProgress(0);
    },
    onSuccess: (res) => {
      setKlingTaskId(res.taskId);
      toast.success(t(lang, 'toastTaskReceived'), { id: "kg" });
      // Refresh credits after starting a generation
      qc.invalidateQueries({ queryKey: ['billingMe'] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || '');
      if (msg === 'subscription_required') {
        toast.error(`${t(lang,'errSubRequired')} — ${t(lang,'hintSeePlans')}` , { id: 'kg' });
      } else if (msg === 'quota_exceeded') {
        toast.error(`${t(lang,'errQuotaExceeded')} — ${t(lang,'hintManageSubscription')}`, { id: 'kg' });
      } else {
        toast.error(msg || t(lang, 'toastError'), { id: 'kg' });
      }
    }
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
      toast.error(statusData.message || t(lang, 'toastGenFailed'), { id: "ks" });
      setKlingTaskId(null);
      setProgress(0);
      qc.removeQueries({ queryKey: statusQueryKey });
    } else if (statusData.status === "succeed" && statusData.videoUrl) {
      toast.success(t(lang, 'toastVideoReady'), { id: "ks" });
      setFinalVideoUrl(statusData.videoUrl);
      setKlingTaskId(null);
      setProgress(100);
      qc.removeQueries({ queryKey: statusQueryKey });
      const el = document.getElementById("kling-video");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [statusData, qc, statusQueryKey]);

  // Enregistrer automatiquement dans la bibliothèque
  const saveToLibrary = useMutation({
    mutationFn: async (vars: { title?: string; project?: string; tags?: string[] }) => {
      if (!finalVideoUrl) throw new Error("Aucune vidéo à sauvegarder");
      const r = await fetch("/api/library/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: finalVideoUrl, ...vars }),
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      return r.item;
    },
    onMutate: () => toast.loading("Enregistrement dans la bibliothèque…", { id: "lib" }),
    onSuccess: () => toast.success(t(lang, 'toastSaved'), { id: "lib" }),
    onError: (e: any) => toast.error(e?.message || t(lang, 'toastError'), { id: "lib" }),
  });
  const save4kToLibrary = useMutation({
    mutationFn: async (url: string) => {
      const r = await fetch("/api/library/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: url, tags: ["4k"] }),
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      return r.item;
    },
    onMutate: () => toast.loading("Enregistrement 4K…", { id: "lib4k" }),
    onSuccess: () => toast.success("4K enregistrée ✅", { id: "lib4k" }),
    onError: (e: any) => toast.error(e?.message || "Erreur", { id: "lib4k" }),
  });

  // 5) Upscale 4K via Topaz (state)
  const [topazTaskId, setTopazTaskId] = useState<string | null>(null);
  const [topaz4kUrl, setTopaz4kUrl] = useState<string | null>(null);
  
  const [topazMeta, setTopazMeta] = useState<{ resolution?: { width: number; height: number }; duration?: number; frameRate?: number } | null>(null);
  const [topazProgress, setTopazProgress] = useState(0);

  // Évite les doublons: n'enregistre qu'une fois par URL
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (finalVideoUrl && savedUrl !== finalVideoUrl) {
      saveToLibrary.mutate({});
      setSavedUrl(finalVideoUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalVideoUrl]);
  const [saved4kUrl, setSaved4kUrl] = useState<string | null>(null);
  useEffect(() => {
    if (topaz4kUrl && saved4kUrl !== topaz4kUrl) {
      save4kToLibrary.mutate(topaz4kUrl);
      setSaved4kUrl(topaz4kUrl);
    }
  }, [topaz4kUrl, saved4kUrl, save4kToLibrary]);

  // 5) Upscale 4K via Topaz
  const createTopazUpscale = useMutation({
    mutationFn: async () => {
      if (!finalVideoUrl) throw new Error("Pas de vidéo disponible");
      const r = await fetch("/api/topaz/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputUrl: finalVideoUrl, meta: topazMeta || undefined })
      }).then(r => r.json());
      if (r.error || !r.taskId) throw new Error(r.error || "taskId absent");
      return r.taskId as string;
    },
    onMutate: () => {
      toast.loading(t(lang, 'toast4kStart'), { id: "tpz" });
      setTopazTaskId(null);
      setTopaz4kUrl(null);
      setTopazProgress(0);
    },
    onSuccess: (taskId) => {
      setTopazTaskId(taskId);
      toast.success(t(lang, 'toast4kReceived'), { id: "tpz" });
    },
    onError: (e: any) => {
      const msg = String(e?.message || '');
      if (msg === 'subscription_required') {
        toast.error(`${t(lang,'errSubRequired')} — ${t(lang,'hintSeePlans')}`, { id: 'tpz' });
      } else if (msg === 'fourk_not_included') {
        toast.error(`${t(lang,'err4kNotIncluded')} — ${t(lang,'hintManageSubscription')}`, { id: 'tpz' });
      } else {
        toast.error(msg || t(lang, 'toast4kError'), { id: 'tpz' });
      }
    }
  });

  // Debug Topaz removed

  const topazKey = useMemo(() => ["topazUpscale", topazTaskId], [topazTaskId]);
  const { data: topazStatus } = useQuery({
    queryKey: topazKey,
    enabled: !!topazTaskId,
    queryFn: async () => {
      const r = await fetch(`/api/topaz/status?taskId=${encodeURIComponent(topazTaskId!)}`).then(r => r.json());
      if (r.error) throw new Error(r.error);
      return r as { status?: string; videoUrl?: string | null; message?: string | null };
    },
    refetchInterval: 5000,
    retry: false,
  });

  useEffect(() => {
    if (!topazStatus) return;
    if (topazStatus.status === "failed") {
      toast.error(topazStatus.message || t(lang, 'toast4kFailed'), { id: "tpzs" });
      setTopazTaskId(null);
      qc.removeQueries({ queryKey: topazKey });
    } else if ((topazStatus.status === "succeeded" || topazStatus.status === "success") && topazStatus.videoUrl) {
      toast.success(t(lang, 'toast4kReady'), { id: "tpzs" });
      setTopaz4kUrl(topazStatus.videoUrl);
      setTopazTaskId(null);
      setTopazProgress(100);
      qc.removeQueries({ queryKey: topazKey });
    }
  }, [topazStatus, qc, topazKey]);

  // Indicative progress while RA 4K pending
  useEffect(() => {
    if (!topazTaskId) return;
    let mounted = true;
    const start = Date.now();
    const maxMs = 12 * 60 * 1000; // 12 minutes
    const tick = () => {
      if (!mounted) return;
      const elapsed = Date.now() - start;
      const v = Math.min(95, (elapsed / maxMs) * 85 + 8);
      setTopazProgress(v);
      if (topazTaskId) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(id); };
  }, [topazTaskId]);



  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Étapes (progression) */}
      <div className="rounded-2xl border bg-neutral-50 p-6 lg:col-span-2">
        {(() => {
          const step1Done = !!imageUrl; // après upload (ou nettoyage)
          const step2Done = !!result;   // après analyse OK
          const step3Done = !!finalVideoUrl; // vidéo prête
          const step4Done = !!topaz4kUrl; // Upscale 4K (Topaz)

          const step1Active = uploadAndAnalyze.isPending && !step1Done;
          const step2Active = runAnalyze.isPending && !step2Done;
          const step3Active = (createKling.isPending || !!klingTaskId) && !step3Done;
          const step4Active = (!!topazTaskId);

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
                <div className="text-xs mt-1">{t(lang, 'stepsTitle1')}</div>
              </div>
              <div className={boxClass(step2Done, step2Active)}>
                <div className={numClass(step2Done, step2Active) + " step-number"}>2</div>
                <div className="text-xs mt-1">{t(lang, 'stepsTitle2')}</div>
              </div>
              <div className={boxClass(step3Done, step3Active)}>
                <div className={numClass(step3Done, step3Active) + " step-number"}>3</div>
                <div className="text-xs mt-1">{t(lang, 'stepsTitle3')}</div>
              </div>
            </div>
          );
        })()}
      </div>
      {/* Colonne gauche : Upload + Nettoyage + Analyse + Génération + Upscale */}
      <div className="space-y-6">
        {/* Upload */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t(lang, 'uploadHeader')}</h2>
          <p className="text-sm text-neutral-600 mt-1">{t(lang, 'formatsHint')}</p>

          <label
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={clsx(
              "mt-4 block rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer",
              "bg-neutral-50 hover:bg-neutral-100",
              "border-neutral-300",
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
                <span className="font-medium text-black">{file.name}</span>
              ) : (
                <>{t(lang, 'uploadDropHint')}</>
              )}
            </div>
          </label>

          <div className="mt-4 flex gap-3">
            <button
              className="inline-flex items-center justify-center rounded-lg bg-[#F9D83C] px-4 py-2 text-black hover:bg-[#F9D83C]/90 disabled:opacity-60"
              onClick={() => file && uploadAndAnalyze.mutate(file)}
              disabled={!file || uploadAndAnalyze.isPending}
            >
              {uploadAndAnalyze.isPending ? t(lang, 'uploading') : t(lang, 'uploadButton')}
            </button>
            <button
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50 disabled:opacity-50"
              onClick={() => { setFile(null); setImageUrl(null); setCleanedUrl(null); setResult(null); setFinalVideoUrl(null); setCameraMotion('forward_push'); }}
              disabled={uploadAndAnalyze.isPending}
            >
              {t(lang, 'reset')}
            </button>
          </div>
        </div>

        {/* Nettoyage personnes + Analyse + Génération */}
        {imageUrl && (
          <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">{t(lang, 'preparation')}</h2>

            {!result && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{t(lang, 'cameraChoiceTitle')}</p>
                  <p className="text-xs text-neutral-500 mt-1">{t(lang, 'cameraChoiceHint')}</p>
                  <div className="mt-3 grid gap-2">
                    {cameraOptions.map((option) => (
                      <label
                        key={option.value}
                        className={clsx(
                          'flex items-start gap-3 rounded-lg border px-3 py-2 transition',
                          cameraMotion === option.value ? 'border-black bg-neutral-50 shadow-sm' : 'border-neutral-200 hover:border-neutral-400',
                          !runAnalyze.isPending && 'cursor-pointer',
                          runAnalyze.isPending && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <input
                          type="radio"
                          name="camera-motion"
                          value={option.value}
                          checked={cameraMotion === option.value}
                          onChange={() => setCameraMotion(option.value)}
                          disabled={runAnalyze.isPending}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{option.label}</div>
                          <div className="text-xs text-neutral-500">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-600/90 disabled:opacity-60"
                      onClick={() => setShowRemoveConfirm(true)}
                      disabled={removePeople.isPending}
                    >
                      {removePeople.isPending ? t(lang, 'removingPeople') : t(lang, 'removePeople')}
                    </button>
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-rose-700 ring-1 ring-rose-200">Beta</span>
                  </div>

                  <button
                    className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 disabled:opacity-60"
                    onClick={() => runAnalyze.mutate({ cameraMotion })}
                    disabled={runAnalyze.isPending}
                  >
                    {runAnalyze.isPending ? t(lang, 'analyzing') : t(lang, 'analyzeImage')}
                  </button>
                </div>
              </div>
            )}

            {result && (
              <>
                <h3 className="font-semibold">Image analysée — prête à être animée</h3>
                <p className="text-sm text-neutral-600">{t(lang, 'generateHint')}</p>
                {(() => {
                  const motionKey = ((result.cameraMotion as CameraMotion) || cameraMotion) as CameraMotion;
                  const optionLabel = cameraOptionLabels[motionKey] ?? cameraOptionLabels.forward_push;
                  return (
                    <div className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                      {t(lang, 'cameraSelectionLabel', { option: optionLabel })}
                    </div>
                  );
                })()}
                <div className="flex gap-2 flex-wrap items-center">
                  <button
                    className="inline-flex items-center justify-center rounded-lg bg-[#F9D83C] px-4 py-2 text-black hover:bg-[#F9D83C]/90 disabled:opacity-60"
                    onClick={() => createKling.mutate({ prompt: result.prompt })}
                    disabled={createKling.isPending || !!klingTaskId}
                  >
                    {createKling.isPending ? t(lang, 'generateStarting') : (!!klingTaskId ? t(lang, 'generateInProgress') : t(lang, 'generateAction'))}
                  </button>
                  {creditsBadge}
                </div>
              </>
            )}

            {!!klingTaskId && (
              <div className="space-y-2 pt-2">
                <ProgressBar percent={progress} />
                <p className="text-sm text-neutral-600">{`Tâche: ${statusData?.status || t(lang, 'ra4kSending')}`}</p>
                {statusData?.message && <p className="text-xs text-neutral-500">{statusData.message}</p>}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Colonne droite : aperçu + vidéo */}
      <div className="space-y-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t(lang, 'preview')}</h2>
          {!imageUrl ? (
            <p className="text-sm text-neutral-600 mt-2">{t(lang, 'noImageYet')}</p>
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
          <h2 className="text-lg font-semibold">{t(lang, 'videoGenerated')}</h2>
          {!finalVideoUrl ? (
            <p className="text-sm text-neutral-600 mt-2">{t(lang, 'videoPending')}</p>
          ) : (
            <>
              <video id="kling-video" src={finalVideoUrl} controls className="mt-4 w-full rounded-xl ring-1 ring-black/5" />
              <div className="mt-4 flex items-center gap-3">
                <a
                  href={finalVideoUrl}
                  download
                  className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90"
                >{t(lang, 'download')}</a>
                <a href="/library" className="text-sm rounded-md border px-3 py-2 hover:bg-neutral-50">{t(lang, 'viewLibrary')}</a>
                <button
                  className="inline-flex items-center justify-center rounded-lg bg-[#F9D83C] px-4 py-2 text-black hover:bg-[#F9D83C]/90 disabled:opacity-60 whitespace-nowrap"
                  onClick={() => createTopazUpscale.mutate()}
                  disabled={createTopazUpscale.isPending || !!topazTaskId}
                  title={t(lang, 'upscale4k')}
                >{createTopazUpscale.isPending ? t(lang, 'upscale4k') + '…' : (!!topazTaskId ? t(lang, 'fourkPending') : t(lang, 'upscale4k'))}</button>
              </div>
              {/* Capture metadata once */}
              {finalVideoUrl && (
                <MetadataCapture videoId="kling-video" onMeta={(m) => setTopazMeta(m)} />
              )}
              {!!topazTaskId && (
                <div className="mt-2">
                  <ProgressBar percent={topazProgress} />
                  <div className="mt-1 text-sm text-neutral-600">
                    {(() => {
                      const s = topazStatus?.status;
                      if (s === 'processing' || s === 'queued') {
                        return t(lang, 'ra4kInProgress');
                      }
                      if (s) {
                        return `RA 4K: ${s}${topazStatus?.message ? ` — ${topazStatus.message}` : ''}`;
                      }
                      return t(lang, 'ra4kSending');
                    })()}
                  </div>
                </div>
              )}
              {/* Debug Topaz section removed */}
              {topaz4kUrl && (
                <div className="mt-6">
                  <h3 className="font-semibold">{t(lang, 'version4k')}</h3>
                  <video src={topaz4kUrl} controls className="mt-2 w-full rounded-xl ring-1 ring-black/5" />
                  <div className="mt-3 flex items-center gap-2">
                    <a href={topaz4kUrl} download className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90">{t(lang, 'download')}</a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal confirmation: retirer les personnes */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
            <h3 className="text-lg font-semibold">{t(lang, 'confirmRemoveTitle')}</h3>
            <p className="mt-2 text-sm text-neutral-600">
              {t(lang, 'confirmRemoveBody')}
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="inline-flex items-center justify-center rounded-lg border px-4 py-2 hover:bg-neutral-50"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={removePeople.isPending}
              >
                {t(lang, 'cancel')}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-600/90 disabled:opacity-60"
                onClick={() => { setShowRemoveConfirm(false); removePeople.mutate(); }}
                disabled={removePeople.isPending}
              >
                {t(lang, 'continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetadataCapture({ videoId, onMeta }: { videoId: string; onMeta: (m: { resolution?: { width: number; height: number }; duration?: number; frameRate?: number }) => void }) {
  useEffect(() => {
    const v = document.getElementById(videoId) as HTMLVideoElement | null;
    if (!v) return;
    const handler = () => {
      const width = v.videoWidth;
      const height = v.videoHeight;
      const duration = isFinite(v.duration) ? v.duration : undefined;
      // We often don't know exact frameRate from browser; leave undefined
      onMeta({ resolution: width && height ? { width, height } : undefined, duration });
    };
    if (v.readyState >= 1) handler();
    v.addEventListener('loadedmetadata', handler);
    return () => v.removeEventListener('loadedmetadata', handler);
  }, [videoId, onMeta]);
  return null;
}

// src/lib/kling.ts
// Appels API Kling — Image → Vidéo (model v2.5 pro)
// Endpoints stables /v1/videos/image2video + model_name: "kling-v2-5-pro"

import { getKlingToken } from "@/lib/klingAuth";

function getKlingBaseUrl(): string {
  const raw = (process.env.KLING_API_BASE || "https://api-singapore.klingai.com").trim();
  // Ensure protocol + no trailing slash; validate with URL()
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const normalized = withProto.replace(/\/+$/, "");
  try {
    // Throws on invalid
    new URL(normalized);
    return normalized;
  } catch {
    throw new Error(
      `KLING_API_BASE invalide: "${raw}". Exemple attendu: https://api-singapore.klingai.com`
    );
  }
}

export type CreateTaskInput = {
  imageUrl?: string;         // URL publique (R2)
  imageDataUrl?: string;     // data URL (base64)
  prompt: string;
  durationSec?: number;      // 5 ou 10
  cfgScale?: number;         // 0..1 (défaut 0.5)
  mode?: "std" | "pro";      // défaut "pro"
};

export type CreateTaskResponse = { taskId: string };

export type KlingTaskStatus = "submitted" | "processing" | "succeed" | "failed";

export type StatusResponse = {
  status: KlingTaskStatus;
  message?: string | null;
  videoUrl?: string | null;
};

function extractBase64FromDataUrl(dataUrl: string): string {
  const idx = dataUrl.indexOf("base64,");
  if (idx !== -1) return dataUrl.slice(idx + "base64,".length);
  return dataUrl;
}

function ensureImageParam(imageUrl?: string, imageDataUrl?: string): string {
  if (imageDataUrl) return extractBase64FromDataUrl(imageDataUrl);
  if (imageUrl) {
    const trimmed = imageUrl.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    throw new Error(
      `imageUrl invalide: "${imageUrl}". Fournis une URL https absolue (ex: https://.../image.png) ou utilise imageDataUrl (data:base64).`
    );
  }
  throw new Error("Aucune image fournie (ni URL publique, ni base64).");
}

/** Crée une tâche Kling Image→Vidéo (model v2.5 pro) et renvoie { taskId } */
export async function createImageToVideoTask(input: CreateTaskInput): Promise<CreateTaskResponse> {
  const token = getKlingToken();
  const image = ensureImageParam(input.imageUrl, input.imageDataUrl);

  const body = {
    model_name: "kling-v2-5-pro",
    mode: input.mode || "pro",
    duration: String(input.durationSec ?? 5), // "5" ou "10"
    image,                                    // URL publique ou base64 pur
    prompt: input.prompt,
    cfg_scale: input.cfgScale ?? 0.5
  };

  const base = getKlingBaseUrl();
  const res = await fetch(`${base}/v1/videos/image2video`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || data?.code !== 0) {
    let msg = data?.message || `HTTP ${res.status} ${res.statusText}`;
    // Normalize specific known errors
    if (typeof msg === 'string' && /account balance not enough/i.test(msg)) {
      // Return only the code, without any prefix
      throw new Error('Error 0411');
    }
    if (typeof msg === 'string' && /model is not supported/i.test(msg)) {
      throw new Error('Error 2802');
    }
    throw new Error(`Kling create task error: ${msg}`);
  }

  const taskId = data?.data?.task_id as string | undefined;
  if (!taskId) throw new Error("Réponse Kling invalide: task_id manquant.");
  return { taskId };
}

/** Récupère le statut d’une tâche Kling (et l’URL vidéo si prête). */
export async function getImageToVideoStatus(taskId: string): Promise<StatusResponse> {
  const token = getKlingToken();

  const base = getKlingBaseUrl();
  const res = await fetch(`${base}/v1/videos/image2video/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || data?.code !== 0) {
    const msg = data?.message || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`Kling status error: ${msg}`);
  }

  const status = (data?.data?.task_status || "submitted") as KlingTaskStatus;
  const message = (data?.data?.task_status_msg as string) || null;
  const videos = data?.data?.task_result?.videos as Array<{ url?: string | null }> | undefined;
  const videoUrl = Array.isArray(videos) && videos.length > 0 ? (videos[0]?.url || null) : null;

  return { status, message, videoUrl };
}

/** Polling utilitaire (optionnel) */
export async function waitForKlingResult(
  taskId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<StatusResponse> {
  const intervalMs = opts?.intervalMs ?? 4000;
  const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const st = await getImageToVideoStatus(taskId);
    if (st.status === "failed") return st;
    if (st.status === "succeed" && st.videoUrl) return st;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "processing", message: "Timeout côté Kling", videoUrl: null };
}

// src/lib/runway.ts
// Thin wrappers for Runway video generation + upscale, configurable via env.
// Set these in Vercel:
//  - RUNWAY_API_KEY
//  - RUNWAY_BASE (default https://api.runwayml.com)
//  - RUNWAY_CREATE_PATH (e.g., /v1/videos/image2video or your account-specific path)
//  - RUNWAY_STATUS_PATH_TEMPLATE (e.g., /v1/videos/{taskId})
//  - RUNWAY_UPSCALE_PATH (e.g., /v1/videos/upscale)

export type RWCreateInput = {
  prompt: string;
  imageUrl?: string;
  imageDataUrl?: string;
  durationSec?: number; // 5 or 10 typically
};

export type RWCreateResponse = { taskId: string; raw?: any };
export type RWTaskStatus = "submitted" | "processing" | "succeed" | "failed";
export type RWStatusResponse = { status: RWTaskStatus; videoUrl?: string | null; message?: string | null };

function baseUrl(): string {
  const b = (process.env.RUNWAY_BASE || "https://api.runwayml.com").replace(/\/+$/, "");
  try { new URL(b); return b; } catch { throw new Error(`RUNWAY_BASE invalide: ${b}`); }
}

function authHeaders() {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) throw new Error("RUNWAY_API_KEY manquante");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    // Runway API requires an explicit version header
    // Set RUNWAY_API_VERSION from docs (e.g. 2024-10-01)
    "X-Runway-Version": process.env.RUNWAY_API_VERSION || "2024-10-01",
    // add common alt headers to maximize compatibility if gateway differs
    "x-api-key": key,
    "X-API-Key": key,
  } as Record<string, string>;
}

export async function runwayCreateTask(input: RWCreateInput): Promise<RWCreateResponse> {
  const path = process.env.RUNWAY_CREATE_PATH || "/v1/videos/image2video";
  const url = `${baseUrl()}${path}`;

  const image = input.imageDataUrl || input.imageUrl;
  if (!image) throw new Error("Aucune image fournie pour Runway");

  const body = {
    model: "gen-3.5",
    duration: input.durationSec || 5,
    prompt: input.prompt,
    image,
  } as Record<string, any>;
  const extra = process.env.RUNWAY_EXTRA_JSON;
  if (extra) {
    try { Object.assign(body, JSON.parse(extra)); } catch {}
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  } catch (e: any) {
    throw new Error(`Runway fetch error (create): ${e?.message || e} [url: ${url}]`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.code && data.code !== 0)) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Runway create error: ${msg}`);
  }
  const id = data?.id || data?.task_id || data?.data?.id;
  if (!id) throw new Error("Réponse Runway invalide: task id manquant");
  return { taskId: String(id), raw: data };
}

export async function runwayGetStatus(taskId: string): Promise<RWStatusResponse> {
  const tmpl = process.env.RUNWAY_STATUS_PATH_TEMPLATE || "/v1/videos/{taskId}";
  const url = `${baseUrl()}${tmpl.replace("{taskId}", encodeURIComponent(taskId))}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: authHeaders() });
  } catch (e: any) {
    throw new Error(`Runway fetch error (status): ${e?.message || e} [url: ${url}]`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Runway status error: ${msg}`);
  }
  const s = (data?.status || data?.state || data?.data?.status || "submitted").toString().toLowerCase();
  let status: RWTaskStatus = "processing";
  if (["submitted", "queued", "pending"].includes(s)) status = "submitted";
  else if (["running", "processing", "in_progress"].includes(s)) status = "processing";
  else if (["succeed", "completed", "done", "success"].includes(s)) status = "succeed";
  else if (["failed", "error"].includes(s)) status = "failed";
  const urlOut = data?.video_url || data?.result_url || data?.data?.video_url || null;
  const message = data?.message || data?.status_msg || null;
  return { status, videoUrl: urlOut, message };
}

export async function runwayUpscale4k(taskIdOrUrl: string): Promise<{ taskId: string }> {
  const path = process.env.RUNWAY_UPSCALE_PATH || "/v1/videos/upscale";
  const url = `${baseUrl()}${path}`;
  const body = { input: taskIdOrUrl, target: "4k" } as Record<string, any>;
  const extra = process.env.RUNWAY_UPSCALE_EXTRA_JSON;
  if (extra) {
    try { Object.assign(body, JSON.parse(extra)); } catch {}
  }
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  } catch (e: any) {
    throw new Error(`Runway fetch error (upscale): ${e?.message || e} [url: ${url}]`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Runway upscale error: ${msg}`);
  }
  const id = data?.id || data?.task_id || data?.data?.id;
  if (!id) throw new Error("Réponse Runway invalide (upscale): task id manquant");
  return { taskId: String(id) };
}

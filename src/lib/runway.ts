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

export type RWCreateResponse = { taskId: string };
export type RWTaskStatus = "submitted" | "processing" | "succeed" | "failed";
export type RWStatusResponse = { status: RWTaskStatus; videoUrl?: string | null; message?: string | null };

function baseUrl(): string {
  const b = (process.env.RUNWAY_BASE || "https://api.runwayml.com").replace(/\/+$/, "");
  try { new URL(b); return b; } catch { throw new Error(`RUNWAY_BASE invalide: ${b}`); }
}

function authHeaders() {
  const key = process.env.RUNWAY_API_KEY;
  if (!key) throw new Error("RUNWAY_API_KEY manquante");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
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

  const res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && data.code && data.code !== 0)) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Runway create error: ${msg}`);
  }
  const id = data?.id || data?.task_id || data?.data?.id;
  if (!id) throw new Error("Réponse Runway invalide: task id manquant");
  return { taskId: String(id) };
}

export async function runwayGetStatus(taskId: string): Promise<RWStatusResponse> {
  const tmpl = process.env.RUNWAY_STATUS_PATH_TEMPLATE || "/v1/videos/{taskId}";
  const url = `${baseUrl()}${tmpl.replace("{taskId}", encodeURIComponent(taskId))}`;
  const res = await fetch(url, { headers: authHeaders() });
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
  const res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Runway upscale error: ${msg}`);
  }
  const id = data?.id || data?.task_id || data?.data?.id;
  if (!id) throw new Error("Réponse Runway invalide (upscale): task id manquant");
  return { taskId: String(id) };
}


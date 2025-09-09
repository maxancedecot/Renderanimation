// src/lib/topaz.ts
// Thin wrapper for Topaz Labs Video AI API (configurable via env).
// Required env:
//  - TOPAZ_API_KEY
//  - TOPAZ_BASE (default https://api.topazlabs.com)
//  - TOPAZ_CREATE_PATH (e.g., /v1/video/jobs)
//  - TOPAZ_STATUS_PATH_TEMPLATE (e.g., /v1/video/jobs/{taskId})
// Optional:
//  - TOPAZ_EXTRA_JSON (stringified JSON to merge into create body)

export type TopazStatus = "queued" | "processing" | "succeeded" | "failed";
export type TopazStatusResponse = { status: TopazStatus; videoUrl?: string | null; message?: string | null };

function baseUrl(): string {
  return (process.env.TOPAZ_BASE || "https://api.topazlabs.com").replace(/\/+$/, "");
}

function authHeaders() {
  const key = process.env.TOPAZ_API_KEY;
  if (!key) throw new Error("TOPAZ_API_KEY manquante");
  const headerName = (process.env.TOPAZ_AUTH_HEADER || "Authorization").trim();
  const scheme = (process.env.TOPAZ_AUTH_SCHEME || "Bearer").trim(); // e.g., "Bearer", "ApiKey", or "" for none
  const value = scheme ? `${scheme} ${key}` : key;
  const headers: Record<string, string> = {
    [headerName]: value,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // Add common alternatives to maximize compatibility
  headers["x-api-key"] = key;
  headers["X-API-Key"] = key;
  headers["Api-Key"] = key;
  return headers;
}

export async function topazCreateUpscale(inputUrl: string): Promise<{ taskId: string; raw?: any }> {
  const path = process.env.TOPAZ_CREATE_PATH || "/v1/video/jobs";
  const url = `${baseUrl()}${path}`;

  // Map requested settings
  const body: Record<string, any> = {
    input_url: inputUrl,
    // High-level request; exact schema may vary by vendor — keep configurable
    operations: {
      upscale: {
        model: "proteus",
        scale: 2, // 2x to reach ~4K from 1080p
        noise: 0,
        recover_detail: 100,
        focus_fix: false,
        grain: 0,
        mode: "dynamic",
        fix_compression: 0,
        improve_details: 100,
        sharpen: 0,
        reduce_noise: 0,
        dehalo: 0,
        anti_alias_deblur: 100,
      },
      frame_interpolation: {
        fps: 60,
        ai_model: "chronos_fast",
        duplicate_frames: "replace",
        sensitivity: 10,
      },
    },
  };
  const extra = process.env.TOPAZ_EXTRA_JSON;
  if (extra) {
    try { Object.assign(body, JSON.parse(extra)); } catch {}
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  } catch (e: any) {
    throw new Error(`Topaz fetch error (create): ${e?.message || e} [url: ${url}]`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Topaz create error: ${msg}`);
  }
  const taskId = data?.id || data?.task_id || data?.job_id;
  if (!taskId) throw new Error("Réponse Topaz invalide: task id manquant");
  return { taskId: String(taskId), raw: data };
}

export async function topazGetStatus(taskId: string): Promise<TopazStatusResponse> {
  const tmpl = process.env.TOPAZ_STATUS_PATH_TEMPLATE || "/v1/video/jobs/{taskId}";
  const url = `${baseUrl()}${tmpl.replace("{taskId}", encodeURIComponent(taskId))}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: authHeaders() });
  } catch (e: any) {
    throw new Error(`Topaz fetch error (status): ${e?.message || e} [url: ${url}]`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Topaz status error: ${msg}`);
  }
  const raw = (data?.status || data?.state || "queued").toString().toLowerCase();
  const status: TopazStatus = raw.includes("fail") ? "failed"
    : raw.includes("success") || raw.includes("complete") || raw === "succeeded" ? "succeeded"
    : raw.includes("process") || raw === "running" ? "processing"
    : "queued";
  const videoUrl = data?.output_url || data?.result?.url || data?.outputs?.[0]?.url || null;
  const message = data?.message || data?.status_msg || null;
  return { status, videoUrl, message };
}

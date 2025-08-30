// src/lib/topaz.ts
// Thin Topaz Video AI API wrapper. Endpoints are configured via env to avoid
// coupling with a specific API shape. Provide the exact URLs in Vercel:
//  - TOPAZ_API_KEY: your Topaz Video AI API key
//  - TOPAZ_CREATE_URL: full URL to create an upscale job
//  - TOPAZ_STATUS_URL_TEMPLATE: URL template to check status, use {taskId} placeholder
// Example:
//  TOPAZ_CREATE_URL=https://api.topazlabs.com/video/v1/jobs
//  TOPAZ_STATUS_URL_TEMPLATE=https://api.topazlabs.com/video/v1/jobs/{taskId}

export type TopazCreateResponse = {
  taskId: string;
  raw?: any;
};

export type TopazStatus = "queued" | "processing" | "succeed" | "failed";

export type TopazStatusResponse = {
  status: TopazStatus;
  message?: string | null;
  videoUrl?: string | null;
  raw?: any;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env manquante: ${name}`);
  return v;
}

export async function createTopazUpscaleTask(videoUrl: string): Promise<TopazCreateResponse> {
  const key = requireEnv("TOPAZ_API_KEY");
  const createUrl = requireEnv("TOPAZ_CREATE_URL");

  // Payload kept generic; adjust server-side without code changes by pointing
  // TOPAZ_CREATE_URL to an adapter or by accepting these field names.
  const payload = {
    input_url: videoUrl,
    target_resolution: "4k",
  };

  const res = await fetch(createUrl, {
    method: "POST",
    headers: {
      // Send both common auth header styles unless customized via gateway
      "Authorization": `Bearer ${key}`,
      "x-api-key": key,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });
  let data: any = null;
  const text = await res.text().catch(() => "");
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || `HTTP ${res.status}`;
    throw new Error(`Topaz create error: ${msg}`);
  }
  // Try common id keys
  const taskId = data?.task_id || data?.id || data?.job_id || data?.data?.id;
  if (!taskId) throw new Error("Réponse Topaz invalide: identifiant de tâche manquant");
  return { taskId: String(taskId), raw: data };
}

export async function getTopazUpscaleStatus(taskId: string): Promise<TopazStatusResponse> {
  const key = requireEnv("TOPAZ_API_KEY");
  const tmpl = requireEnv("TOPAZ_STATUS_URL_TEMPLATE");
  const url = tmpl.replace("{taskId}", encodeURIComponent(taskId));

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${key}`,
      "x-api-key": key,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });
  let data: any = null;
  const text = await res.text().catch(() => "");
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || `HTTP ${res.status}`;
    throw new Error(`Topaz status error: ${msg}`);
  }

  // Heuristic extraction
  const s = (data?.status || data?.state || data?.data?.status || "processing").toString().toLowerCase();
  let status: TopazStatus = "processing";
  if (["queued", "pending"].includes(s)) status = "queued";
  else if (["processing", "running", "in_progress"].includes(s)) status = "processing";
  else if (["succeed", "completed", "done", "success"].includes(s)) status = "succeed";
  else if (["failed", "error"].includes(s)) status = "failed";

  const message = (data?.message || data?.status_msg || null) as string | null;
  const out = data?.output_url || data?.result_url || data?.data?.output_url || null;

  return { status, message: message || null, videoUrl: out ? String(out) : null, raw: data };
}

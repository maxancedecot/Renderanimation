// src/lib/topaz.ts
// Wrapper for Topaz Labs Video AI API (multi-step flow per docs).
// Required env:
//  - TOPAZ_API_KEY
// Optional env (with sensible defaults matching Topaz docs):
//  - TOPAZ_BASE (default https://api.topazlabs.com)
//  - TOPAZ_CREATE_PATH (default /video/)
//  - TOPAZ_ACCEPT_PATH_TEMPLATE (default /video/{taskId}/accept)
//  - TOPAZ_COMPLETE_UPLOAD_PATH_TEMPLATE (default /video/{taskId}/complete-upload)
//  - TOPAZ_STATUS_PATH_TEMPLATE (default /video/{taskId}/status)
//  - TOPAZ_EXTRA_JSON (stringified JSON to merge into create body)

export type TopazStatus = "queued" | "processing" | "succeeded" | "failed";
export type TopazStatusResponse = { status: TopazStatus; videoUrl?: string | null; message?: string | null };

function baseUrl(): string {
  return (process.env.TOPAZ_BASE || "https://api.topazlabs.com").replace(/\/+$/, "");
}

function authHeaders() {
  const key = process.env.TOPAZ_API_KEY || "";
  if (!key) throw new Error("TOPAZ_API_KEY manquante");
  const primaryHeader = (process.env.TOPAZ_AUTH_HEADER || 'X-API-Key').trim();
  const scheme = (process.env.TOPAZ_AUTH_SCHEME || '').trim();
  const authValue = scheme ? `${scheme} ${key}`.trim() : key;

  // Send ONLY the primary header in strict mode
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    [primaryHeader]: authValue,
  };

  // If not strict, add common alternates
  if (process.env.TOPAZ_STRICT_AUTH !== '1') {
    headers['x-api-key'] = key;
    headers['Api-Key'] = key;
    headers['Authorization'] = authValue;
  }

  return headers;
}

// Extract first http(s) URL from a nested object/array
function extractFirstUrl(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') {
    if (/^https?:\/\//i.test(obj)) return obj;
    return null;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) { const u = extractFirstUrl(v); if (u) return u; }
    return null;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) { const u = extractFirstUrl(obj[k]); if (u) return u; }
  }
  return null;
}

function guessContainerFromUrl(url: string): string {
  const u = url.split('?')[0].toLowerCase();
  if (u.endsWith('.webm')) return 'webm';
  if (u.endsWith('.mov')) return 'mov';
  if (u.endsWith('.mkv')) return 'mkv';
  if (u.endsWith('.avi')) return 'avi';
  return 'mp4';
}

async function probeInputHead(inputUrl: string): Promise<{ size?: number; contentType?: string; container: string }> {
  try {
    const r = await fetch(inputUrl, { method: 'HEAD' });
    const cl = r.headers.get('content-length');
    const ct = r.headers.get('content-type') || undefined;
    const size = cl ? Number(cl) : undefined;
    return { size, contentType: ct, container: guessContainerFromUrl(inputUrl) };
  } catch {
    return { container: guessContainerFromUrl(inputUrl) };
  }
}

export async function buildTopazCreateBody(inputUrl: string): Promise<Record<string, any>> {
  const head = await probeInputHead(inputUrl);
  const body: Record<string, any> = {
    source: {
      // If unknown, leave some fields out; Topaz derives details after upload
      container: head.container,
      ...(head.size ? { size: head.size } : {}),
    },
    output: {
      // Target 4K (2x typical from 1080p)
      resolution: { width: 3840, height: 2160 },
      audioCodec: 'AAC',
      audioTransfer: 'Copy',
      frameRate: 60,
      dynamicCompressionLevel: 'High',
      container: 'mp4',
    },
    filters: [
      {
        // Example per docs; you can override via TOPAZ_EXTRA_JSON
        model: 'apo-8',
        slowmo: 1,
        fps: 60,
        duplicate: true,
        duplicateThreshold: 0.1,
      },
    ],
  };
  const extra = process.env.TOPAZ_EXTRA_JSON;
  if (extra) {
    try { Object.assign(body, JSON.parse(extra)); } catch {}
  }
  return body;
}

async function topazCreateRequest(inputUrl: string): Promise<{ requestId: string; raw: any }> {
  const path = process.env.TOPAZ_CREATE_PATH || "/video/";
  const url = `${baseUrl()}${path}`;
  const body = await buildTopazCreateBody(inputUrl);
  let res: Response;
  try {
    // Temporary outbound log with masked header values
    const endpointEnv = `${process.env.TOPAZ_BASE || ''}${process.env.TOPAZ_CREATE_PATH || ''}`;
    const hdrs = authHeaders();
    console.log('topaz outbound', {
      endpoint: endpointEnv,
      headers: Object.fromEntries(Object.entries(hdrs).map(([k, v]) => [k, v ? '****' : '']))
    });
    res = await fetch(url, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
  } catch (e: any) {
    throw new Error(`Topaz fetch error (create): ${e?.message || e} [url: ${url}]`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Topaz create error: ${msg}`);
  }
  const id = data?.id || data?.requestId || data?.request_id || data?.job_id;
  if (!id) throw new Error("Réponse Topaz invalide (create): id manquant");
  return { requestId: String(id), raw: data };
}

async function topazAccept(requestId: string): Promise<{ uploadUrl: string; raw: any }> {
  const tmpl = process.env.TOPAZ_ACCEPT_PATH_TEMPLATE || "/video/{taskId}/accept";
  const url = `${baseUrl()}${tmpl.replace("{taskId}", encodeURIComponent(requestId))}`;
  let res: Response;
  try {
    res = await fetch(url, { method: "PATCH", headers: authHeaders() });
  } catch (e: any) {
    throw new Error(`Topaz fetch error (accept): ${e?.message || e} [url: ${url}]`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Topaz accept error: ${msg}`);
  }
  const uploadUrl = extractFirstUrl(data);
  if (!uploadUrl) throw new Error("Réponse Topaz invalide (accept): aucune URL d’upload trouvée");
  return { uploadUrl, raw: data };
}

async function uploadToSignedUrl(uploadUrl: string, buffer: Buffer, contentType = "video/mp4"): Promise<{ eTag?: string | null }> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: buffer as any });
  } catch (e: any) {
    throw new Error(`Upload PUT failed: ${e?.message || e}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload PUT error: HTTP ${res.status} ${res.statusText} ${text}`);
  }
  // ETag often in quotes
  const etag = res.headers.get('etag') || res.headers.get('ETag');
  return { eTag: etag ? etag.replace(/^"|"$/g, '') : null };
}

async function topazCompleteUpload(requestId: string, parts: Array<{ partNum: number; eTag: string }>): Promise<any> {
  const tmpl = process.env.TOPAZ_COMPLETE_UPLOAD_PATH_TEMPLATE || "/video/{taskId}/complete-upload";
  const url = `${baseUrl()}${tmpl.replace("{taskId}", encodeURIComponent(requestId))}`;
  const body = { uploadResults: parts } as any;
  let res: Response;
  try {
    res = await fetch(url, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
  } catch (e: any) {
    throw new Error(`Topaz fetch error (complete-upload): ${e?.message || e} [url: ${url}]`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Topaz complete-upload error: ${msg}`);
  }
  return data;
}

export async function topazCreateUpscale(inputUrl: string): Promise<{ taskId: string; raw?: any }> {
  // 1) Create request with proper body
  const { requestId } = await topazCreateRequest(inputUrl);
  // 2) Accept to get upload URL(s)
  const { uploadUrl } = await topazAccept(requestId);
  // 3) Download source
  const res = await fetch(inputUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Téléchargement vidéo échoué: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || 'video/mp4';
  const buffer = Buffer.from(await res.arrayBuffer());
  // 4) Upload to signed URL
  const { eTag } = await uploadToSignedUrl(uploadUrl, buffer, contentType);
  // 5) Complete upload (single part)
  if (!eTag) throw new Error("ETag manquant après upload — nécessaire pour complete-upload");
  await topazCompleteUpload(requestId, [{ partNum: 1, eTag }]);
  // Now Topaz will start processing the job
  return { taskId: requestId };
}

export async function topazGetStatus(taskId: string): Promise<TopazStatusResponse> {
  const tmpl = process.env.TOPAZ_STATUS_PATH_TEMPLATE || "/video/{taskId}/status";
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
  const raw = (data?.status || data?.state || data?.jobStatus || "queued").toString().toLowerCase();
  const status: TopazStatus = raw.includes("fail") ? "failed"
    : raw.includes("success") || raw.includes("complete") || raw === "succeeded" ? "succeeded"
    : raw.includes("process") || raw === "running" ? "processing"
    : "queued";
  const videoUrl = data?.output_url || data?.result?.url || data?.outputs?.[0]?.url || data?.downloadUrl || null;
  const message = data?.message || data?.status_msg || null;
  return { status, videoUrl, message };
}

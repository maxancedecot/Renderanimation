// src/lib/runwayClient.ts

export async function createRunwayTask(params: {
  imageUrl: string;
  prompt: string;
  duration?: number;
  orientation?: string;
  model?: string;
}): Promise<string> {
  const r = await fetch('/api/runway/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: params.imageUrl,
      prompt: params.prompt,
      duration: params.duration ?? 5,
      orientation: params.orientation ?? 'landscape',
      model: params.model ?? 'gen4_turbo'
    })
  }).then(res => res.json());
  if (r.error || !r.taskId) throw new Error(r.error || 'taskId absent');
  return r.taskId as string;
}

export async function pollRunwayStatus(taskId: string, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<{ status: string; videoUrl?: string | null }>{
  const intervalMs = opts?.intervalMs ?? 4000;
  const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const r = await fetch(`/api/runway/status?id=${encodeURIComponent(taskId)}`).then(res => res.json());
    if (r.error) throw new Error(r.error);
    if (r.status === 'failed') return r;
    if (r.status === 'succeeded' && r.videoUrl) return r;
    await new Promise(res => setTimeout(res, intervalMs));
  }
  return { status: 'running', videoUrl: null };
}


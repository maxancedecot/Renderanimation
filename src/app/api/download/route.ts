import { NextRequest, NextResponse } from 'next/server';

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split('/').pop() || 'video.mp4';
    // Basic sanitization
    return base.replace(/[^A-Za-z0-9._-]/g, '_');
  } catch {
    return 'video.mp4';
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  // Optional: restrict to known public base if provided via env
  const allowedBase = process.env.CDN_BASE || process.env.S3_ENDPOINT;
  if (allowedBase) {
    try {
      const u = new URL(url);
      const baseHost = (process.env.CDN_BASE || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const s3Host = (process.env.S3_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const host = u.host;
      if (baseHost && host !== baseHost && !u.href.startsWith((process.env.CDN_BASE || '').replace(/\/$/, '') + '/')) {
        // not matching CDN_BASE
        if (!s3Host || host !== s3Host) {
          return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
        }
      }
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }
  }

  let res: globalThis.Response;
  try {
    res = await fetch(url);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Fetch failed' }, { status: 502 });
  }
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: `Upstream error: ${res.status}` }, { status: 502 });
  }

  const filename = filenameFromUrl(url);

  // Pass through type/length if present
  const headers = new Headers();
  const type = res.headers.get('content-type') || 'application/octet-stream';
  const len = res.headers.get('content-length');
  headers.set('Content-Type', type);
  if (len) headers.set('Content-Length', len);
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Cache-Control', 'no-store');

  return new NextResponse(res.body, { status: 200, headers });
}


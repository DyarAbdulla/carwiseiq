import { NextResponse } from 'next/server';

function backendBaseUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    '';
  const trimmed = raw.replace(/\/$/, '');
  return trimmed || null;
}

/**
 * Proxies ban check to FastAPI with the browser IP (X-Forwarded-For), same as /api/chat.
 * Avoids CORS and matches ip_bans / user_bans to the real client.
 */
export async function GET(request: Request) {
  const base = backendBaseUrl();
  if (!base) {
    return NextResponse.json(
      { banned: false, ends_at: null, error: 'backend_unconfigured' },
      { status: 200 }
    );
  }

  const xff =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('cf-connecting-ip');
  const realIp = request.headers.get('x-real-ip');
  const headers: Record<string, string> = {};
  if (xff) {
    headers['X-Forwarded-For'] = xff;
  } else if (realIp) {
    headers['X-Forwarded-For'] = realIp;
  }

  try {
    const res = await fetch(`${base}/api/security/ip-ban-status`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const text = await res.text();
    let data: unknown = { banned: false, ends_at: null };
    try {
      data = text ? JSON.parse(text) : data;
    } catch {
      data = { banned: false, ends_at: null };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('ip-ban-status proxy error:', e);
    return NextResponse.json({ banned: false, ends_at: null }, { status: 200 });
  }
}

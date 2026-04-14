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
 * Proxies chat to FastAPI so limits, profanity checks, and bans are enforced server-side.
 * Direct Anthropic calls from Next are disabled when a backend URL is configured.
 */
export async function POST(request: Request) {
  const base = backendBaseUrl();
  if (!base) {
    return NextResponse.json(
      {
        error: 'chat_backend_unconfigured',
        message:
          'Chat backend is not configured. Set NEXT_PUBLIC_API_BASE_URL to your FastAPI server.',
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const auth = request.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = auth;

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: 'invalid_upstream', raw: text.slice(0, 500) };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Chat proxy error:', e);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Could not reach chat backend.' },
      { status: 502 }
    );
  }
}

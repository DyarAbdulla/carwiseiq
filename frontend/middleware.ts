import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';
import { NextRequest, NextResponse } from 'next/server';
import { detectLocaleFromRequest } from './lib/detectLocale';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
});

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude Next.js internals and static assets - CRITICAL for preventing 404s
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    /\.(.*)$/.test(pathname) // Matches any file with extension (e.g., .js, .css, .png)
  ) {
    return NextResponse.next();
  }

  // Geolocation-based locale: on first visit (no locale in path, no NEXT_LOCALE cookie), detect from IP
  const isRoot = pathname === '/' || pathname === '';
  const hasLocaleCookie = request.cookies.has('NEXT_LOCALE');
  if (isRoot && !hasLocaleCookie) {
    try {
      const detected = await detectLocaleFromRequest(request);
      const response = NextResponse.redirect(new URL(`/${detected}`, request.url));
      response.cookies.set('NEXT_LOCALE', detected, { path: '/', maxAge: 60 * 60 * 24 * 365 });
      return response;
    } catch {
      // Fall through to default intl middleware
    }
  }

  // Redirect removed /stats and /docs to home (/:locale)
  const match = pathname.match(/^\/(en|ku|ar)\/(stats|docs)\/?$/);
  if (match) {
    return NextResponse.redirect(new URL(`/${match[1]}`, request.url));
  }

  // Security: old admin path is no longer valid - redirect to home (admin route was renamed to a secret path)
  const adminLegacyMatch = pathname.match(/^\/(en|ku|ar)\/admin(\/|$)/);
  if (adminLegacyMatch) {
    return NextResponse.redirect(new URL(`/${adminLegacyMatch[1]}`, request.url));
  }

  // Let next-intl handle locale routing
  return intlMiddleware(request);
}

export const config = {
  // Match all routes except Next.js internals and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
};



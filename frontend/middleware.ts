import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true, // Use Accept-Language and NEXT_LOCALE cookie on first visit
});

export default function middleware(request: NextRequest) {
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

  // Redirect removed /stats and /docs to home (/:locale)
  const match = pathname.match(/^\/(en|ku|ar)\/(stats|docs)\/?$/);
  if (match) {
    return NextResponse.redirect(new URL(`/${match[1]}`, request.url));
  }

  // Let next-intl handle "/" -> redirect to detected or preferred locale (Accept-Language / NEXT_LOCALE)
  return intlMiddleware(request);
}

export const config = {
  // Match all routes except Next.js internals and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
};



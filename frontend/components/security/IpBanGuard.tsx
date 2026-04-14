'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Checks active IP ban on each navigation via same-origin proxy (forwards real client IP).
 * Redirects to /[locale]/banned when restricted (full ban UX is on that route).
 */
export function IpBanGuard({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!pathname || pathname.includes('/banned')) return;
      try {
        const r = await fetch('/api/security/ip-ban-status', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = (await r.json().catch(() => ({}))) as {
          banned?: boolean;
          ends_at?: string;
        };
        if (cancelled) return;
        if (data.banned && data.ends_at) {
          const q = `until=${encodeURIComponent(data.ends_at)}`;
          router.replace(`/${locale}/banned?${q}`);
        }
      } catch {
        /* offline: allow browsing */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname, locale, router]);

  return <>{children}</>;
}

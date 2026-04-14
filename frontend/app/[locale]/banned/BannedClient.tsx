'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { inter, vazirmatn } from '@/lib/fonts';
import { cn } from '@/lib/utils';

function parseUntil(raw: string | null): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function BannedClient() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const untilIso = searchParams.get('until');
  const endsAt = useMemo(() => parseUntil(untilIso), [untilIso]);
  const [leftMs, setLeftMs] = useState<number>(() =>
    endsAt ? Math.max(0, endsAt - Date.now()) : 0
  );

  const isRTL = locale === 'ku' || locale === 'ar';
  const fontClass = isRTL ? vazirmatn.className : inter.className;

  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => {
      setLeftMs(Math.max(0, endsAt - Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt && leftMs <= 0) {
      router.replace(`/${locale}`);
    }
  }, [leftMs, endsAt, locale, router]);

  return (
    <div
      className={cn(
        fontClass,
        'fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0a0f1c] px-4 text-center text-slate-100'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-md">
        <p className="text-lg leading-relaxed text-slate-100">
          Your access has been temporarily restricted for 5 hours due to inappropriate behavior.
          If you believe this is a mistake, contact support at carwise15@gmail.com
        </p>
        {endsAt ? (
          <p className="mt-6 font-mono text-2xl tabular-nums text-purple-300">
            {formatCountdown(leftMs)}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-400">Time remaining until access is restored</p>
      </div>
    </div>
  );
}

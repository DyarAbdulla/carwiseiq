import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'ku', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const k of Object.keys(override)) {
    const bv = base[k]
    const ov = override[k]
    if (
      ov !== null &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>)
    } else if (ov !== undefined) {
      out[k] = ov
    }
  }
  return out
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale
  }

  const enMessages = (await import('./messages/en.json')).default as Record<string, unknown>
  const localeMessages = (await import(`./messages/${locale}.json`)).default as Record<string, unknown>
  const messages =
    locale === 'en' ? enMessages : deepMerge(enMessages, localeMessages)

  return {
    locale,
    messages,
    getMessageFallback({ namespace, key }: { namespace?: string; key: string }) {
      const path = [namespace, key].filter(Boolean).join('.')
      return path || ''
    },
  };
});


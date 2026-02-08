/**
 * In development, logs when t(key) returns the key itself (missing translation).
 * Use: tKey(t, 'nav.foo') instead of t('nav.foo') in UI.
 */
export function tKey(t: (k: string) => string, key: string): string {
  const out = t(key)
  if (
    typeof window !== 'undefined' &&
    process.env.NODE_ENV === 'development' &&
    out === key
  ) {
    console.warn('[i18n] Missing translation:', key)
  }
  return out
}

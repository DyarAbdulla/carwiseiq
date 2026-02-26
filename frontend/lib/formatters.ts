/**
 * Format prices for Iraq/Kurdistan market.
 * Primary: IQD (Iraqi Dinar), Secondary: USD
 */

export type Currency = "IQD" | "USD"
export type Locale = "en" | "ku" | "ar"

const IQD_LOCALE = "en-IQ" // Iraqi number format
const USD_LOCALE = "en-US"

export function formatPrice(
  amount: number,
  locale: Locale = "en",
  currency: Currency = "IQD",
  options?: { compact?: boolean }
): string {
  if (isNaN(amount) || amount < 0) return "—"
  const numLocale = locale === "ar" ? "ar-IQ" : locale === "ku" ? "ckb-IQ" : IQD_LOCALE
  const formatter = new Intl.NumberFormat(numLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  const formatted = formatter.format(Math.round(amount))
  if (currency === "IQD") {
    return locale === "ar" ? `${formatted} د.ع` : `${formatted} IQD`
  }
  return `$${formatted}`
}

export function formatPriceWithToggle(
  amount: number,
  locale: Locale,
  showUsd: boolean,
  iqdToUsdRate: number = 1310
): string {
  if (showUsd) {
    const usd = amount / iqdToUsdRate
    return formatPrice(usd, locale, "USD")
  }
  return formatPrice(amount, locale, "IQD")
}

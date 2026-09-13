export function formatNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(locale, options).format(value);
}

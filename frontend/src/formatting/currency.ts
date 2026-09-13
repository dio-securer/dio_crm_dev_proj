export function formatCurrency(amount: number, locale: string, currencyCode: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(amount);
}

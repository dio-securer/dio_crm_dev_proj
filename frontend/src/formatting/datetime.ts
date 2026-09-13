export function formatDate(value: string | Date, locale: string, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', ...(timeZone ? { timeZone } : {}) }).format(new Date(value));
}

export function formatDateTime(value: string | Date, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone
  }).format(new Date(value));
}

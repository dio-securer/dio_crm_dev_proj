export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

export function formatPhone(value: string, countryCode?: string) {
  const normalized = normalizePhone(value);
  if (countryCode === 'KR' && /^0\d{9,10}$/.test(normalized)) {
    if (normalized.startsWith('02')) return normalized.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
    return normalized.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  }
  return value;
}

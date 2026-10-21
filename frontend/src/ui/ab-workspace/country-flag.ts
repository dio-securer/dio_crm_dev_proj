const REGION_FLAGS: Record<string, string> = {
  KR: '🇰🇷', US: '🇺🇸', MX: '🇲🇽', IN: '🇮🇳', PT: '🇵🇹', TR: '🇹🇷',
  JP: '🇯🇵', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', CN: '🇨🇳', ES: '🇪🇸'
};

export function countryFlag(code?: string | null): string {
  if (!code) return '🌐';
  const trimmed = code.trim();
  const key = trimmed.toUpperCase().slice(0, 2);
  if (REGION_FLAGS[key]) return REGION_FLAGS[key];
  if (/[가-힣]/.test(trimmed)) return REGION_FLAGS.KR;
  return '🌐';
}

// Canonical file text: keys sorted at every level, 2-space indent, trailing newline. Arrays keep their order.
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) { const v = (value as Record<string, unknown>)[k]; if (v !== undefined) out[k] = sortKeys(v); }
    return out;
  }
  return value;
}
export const canonicalJson = (value: unknown) => JSON.stringify(sortKeys(value), null, 2) + '\n';

export const MAX_FILE_LINES = 300;
export const MAX_FILE_BYTES = 15000;
export const lineCount = (text: string) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
export const byteCount = (text: string) => new TextEncoder().encode(text).length;
export const fitsLimits = (text: string) => lineCount(text) <= MAX_FILE_LINES && byteCount(text) <= MAX_FILE_BYTES;

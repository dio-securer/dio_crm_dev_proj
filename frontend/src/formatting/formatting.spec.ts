import { describe, expect, it } from 'vitest';
import { formatCurrency } from './currency';
import { formatNumber } from './number';
import { formatDate, formatDateTime } from './datetime';

function normalizeSpace(value:string) { return value.replace(/\s/g, ' '); }

describe('globalization formatting', () => {
  it('formats KRW for ko-KR', () => {
    expect(normalizeSpace(formatCurrency(1234567, 'ko-KR', 'KRW'))).toContain('1,234,567');
  });

  it('formats USD for en-US', () => {
    expect(formatCurrency(1234.5, 'en-US', 'USD')).toBe('$1,234.50');
  });

  it('can format JPY for a future ja-JP market without activating that market', () => {
    expect(formatCurrency(1234, 'ja-JP', 'JPY')).toMatch(/1,234/);
  });

  it('formats numbers per locale', () => {
    expect(formatNumber(1234.5, 'en-US', { minimumFractionDigits: 1 })).toBe('1,234.5');
  });

  it('preserves a date-only value independently of company timezone', () => {
    const rendered = formatDate('2026-09-13', 'en-US', 'America/Los_Angeles');
    expect(rendered).toMatch(/09\/13\/2026|09\/13\/26/);
  });

  it('applies company timezone to timestamps', () => {
    const rendered = formatDateTime('2026-09-13T00:00:00Z', 'en-US', 'America/New_York');
    expect(rendered).toContain('09/12/2026');
  });
});

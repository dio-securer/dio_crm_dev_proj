import { describe, expect, it } from 'vitest';
import { formatCurrency } from './currency';
import { formatNumber } from './number';
import { formatDate } from './datetime';

function normalizeSpace(value:string) { return value.replace(/\s/g, ' '); }

describe('globalization formatting', () => {
  it('formats KRW for ko-KR', () => {
    expect(normalizeSpace(formatCurrency(1234567, 'ko-KR', 'KRW'))).toContain('1,234,567');
  });

  it('formats USD for en-US', () => {
    expect(formatCurrency(1234.5, 'en-US', 'USD')).toBe('$1,234.50');
  });

  it('formats numbers per locale', () => {
    expect(formatNumber(1234.5, 'en-US', { minimumFractionDigits: 1 })).toBe('1,234.5');
  });

  it('formats date-only with locale and timezone', () => {
    const rendered = formatDate('2026-09-13T00:00:00Z', 'en-US', 'UTC');
    expect(rendered).toMatch(/09\/13\/2026|09\/13\/26/);
  });
});

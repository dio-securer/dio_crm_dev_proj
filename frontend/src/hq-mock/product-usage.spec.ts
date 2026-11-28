import { describe, expect, it } from 'vitest';
import { ACCOUNT_PRODUCTS, hasProductUsage, toggleProductUsage } from './product-usage';

describe('Salesforce account product flags', () => {
  it('includes the verified DDA and cementless product labels', () => {
    expect(ACCOUNT_PRODUCTS).toContain('DDA');
    expect(ACCOUNT_PRODUCTS).toContain('세멘리스');
  });
  it('preserves unrelated free text when toggling new flags', () => {
    const original = '기존 기록\nUF(III)';
    const added = toggleProductUsage(original, 'DDA', true);
    expect(hasProductUsage(added, 'DDA')).toBe(true);
    expect(toggleProductUsage(added, 'DDA', false)).toBe(original);
  });
});

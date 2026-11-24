import { describe, expect, it } from 'vitest';
import { hasProductUsage, toggleProductUsage } from './product-usage';

describe('legacy product usage preservation', () => {
  it('does not interpret a product mentioned in prose as a checked flag', () => {
    expect(hasProductUsage('UV 장비 상담 중; IMP', 'UV')).toBe(false);
    expect(hasProductUsage('UV 장비 상담 중; IMP', 'IMP')).toBe(true);
  });
  it('preserves unknown descriptions while adding and removing exact labels', () => {
    const checked = toggleProductUsage('기존 장비 설명\nIMP', 'UV', true);
    expect(checked).toBe('기존 장비 설명\nIMP\nUV');
    expect(toggleProductUsage(checked, 'IMP', false)).toBe('기존 장비 설명\nUV');
    expect(toggleProductUsage(checked, 'UV', true)).toBe(checked);
  });
});

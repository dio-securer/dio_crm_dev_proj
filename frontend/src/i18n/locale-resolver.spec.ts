import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, normalizeLocale } from './locale-resolver';

describe('locale resolver', () => {
  it('keeps supported locale', () => expect(normalizeLocale('ko-KR')).toBe('ko-KR'));
  it('matches language-only preference', () => expect(normalizeLocale('en-GB')).toBe('en-US'));
  it('returns undefined for unsupported language', () => expect(normalizeLocale('ja-JP')).toBeUndefined());
  it('uses ko-KR as compatibility default', () => expect(DEFAULT_LOCALE).toBe('ko-KR'));
});

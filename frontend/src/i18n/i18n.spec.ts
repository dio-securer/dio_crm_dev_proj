import { describe, expect, it } from 'vitest';
import { changeLocale, i18n } from './index';

describe('i18n foundation', () => {
  it('switches runtime locale between approved source locales', async () => {
    await changeLocale('en-US');
    expect(i18n.t('nav.activity')).toBe('Activities / GPS');
    await changeLocale('ko-KR');
    expect(i18n.t('nav.activity')).toBe('활동 / GPS');
  });

  it('falls back to ko-KR resources for an unknown locale', () => {
    expect(i18n.t('common.save', { lng:'fr-FR' })).toBe('저장');
  });
});

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

  it('resolves canonical lead AB keys in ko-KR and en-US', async () => {
    await changeLocale('ko-KR');
    expect(i18n.t('lead.tabs.keyman')).toBe('Keyman');
    expect(i18n.t('lead.status.FIRST_VISIT')).toBe('초도방문');
    await changeLocale('en-US');
    expect(i18n.t('lead.tabs.keyman')).toBe('Keyman');
    expect(i18n.t('lead.quick.title')).toBe('Quick create Lead');
  });

  it('resolves account AB extension keys', async () => {
    await changeLocale('ko-KR');
    expect(i18n.t('account.tabs.erp')).toBe('ERP');
    expect(i18n.t('account.quick.title')).toBe('Account 빠른 등록');
  });
});

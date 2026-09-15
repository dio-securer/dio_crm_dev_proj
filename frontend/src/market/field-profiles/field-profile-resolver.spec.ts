import { describe, expect, it } from 'vitest';
import { ACCOUNT_INTERFACE_FIELDS, type GlobalizationContext } from '@dio-crm/contracts';
import { FORM_SECTIONS } from '../../account-model';
import { GLOBAL_ACCOUNT_FIELD_PROFILE } from './GLOBAL_ACCOUNT';
import { HQ_ACCOUNT_FIELD_PROFILE } from './HQ_ACCOUNT';
import {
  FieldProfileResolutionError,
  effectiveAccountFields,
  resolveAccountFieldProfile,
  resolveAccountFieldProfileCode,
  toLegacyAccountFormSections,
  visibleAccountSections
} from './field-profile-resolver';

const krContext: GlobalizationContext = {
  locale: 'ko-KR',
  countryCode: 'KR',
  currencyCode: 'KRW',
  timezone: 'Asia/Seoul',
  marketProfileCode: 'KR_SALES',
  fieldProfileCode: 'HQ_FIELD_PROFILE',
  features: {
    HIRA_IMPORT: true,
    DIRECT_WORK: true,
    GPS_CHECKIN: true,
    ACTIVITY_APPROVAL: true,
    ERP_ACCOUNT_APPROVAL: true,
    MONTHLY_STATEMENT: true
  }
};

describe('M4 account field profile foundation', () => {
  it('keeps the current HQ form section order and field coverage exactly', () => {
    expect(toLegacyAccountFormSections(HQ_ACCOUNT_FIELD_PROFILE)).toEqual(
      FORM_SECTIONS.map(section => ({ ...section, codes: [...section.codes] }))
    );
    expect(
      visibleAccountSections(HQ_ACCOUNT_FIELD_PROFILE)
        .flatMap(section => effectiveAccountFields(section).map(item => item.field.code))
        .sort()
    ).toEqual(ACCOUNT_INTERFACE_FIELDS.map(field => field.code).sort());
  });

  it('builds GLOBAL Account sections without the HQ-only HIRA section', () => {
    const sections = visibleAccountSections(GLOBAL_ACCOUNT_FIELD_PROFILE);
    expect(sections.map(section => section.code)).toEqual(['identity', 'basic', 'address', 'erp', 'manage']);
    const codes = sections.flatMap(section => effectiveAccountFields(section).map(item => item.field.code));
    expect(codes).not.toContain('U_Key');
    expect(codes).not.toContain('medical_care_no');
    expect(codes).not.toContain('open_dt');
    expect(codes).not.toContain('doctor_no');
    expect(codes).toEqual(expect.arrayContaining(['biz_no', 'ceo_nm', 'email', 'tel', 'zip_cd', 'cust_cd', 'trade_bc']));
  });

  it('uses existing shared Account interface field codes for GLOBAL instead of a forked API model', () => {
    const catalog = new Set(ACCOUNT_INTERFACE_FIELDS.map(field => field.code));
    const globalCodes = visibleAccountSections(GLOBAL_ACCOUNT_FIELD_PROFILE)
      .flatMap(section => section.fields.filter(field => field.visible).map(field => field.code));
    expect(globalCodes.every(code => catalog.has(code))).toBe(true);
  });

  it('inherits required flags from the existing interface catalog unless a profile overrides them', () => {
    const hira = HQ_ACCOUNT_FIELD_PROFILE.sections.find(section => section.code === 'hira')!;
    const fields = effectiveAccountFields(hira);
    expect(fields.find(item => item.field.code === 'biz_no')?.rule.required).toBe(true);
    expect(fields.find(item => item.field.code === 'doctor_no')?.rule.required).toBe(false);
  });

  it('resolves KR to HQ field profile and supports legacy KR fallback', () => {
    expect(resolveAccountFieldProfile(krContext).code).toBe('HQ_FIELD_PROFILE');
    const legacy = { ...krContext, fieldProfileCode: undefined };
    expect(resolveAccountFieldProfileCode(legacy)).toBe('HQ_FIELD_PROFILE');
  });

  it('resolves GLOBAL by field profile code without country-specific if/else', () => {
    const global = {
      ...krContext,
      countryCode: 'US',
      marketProfileCode: 'US_SALES',
      fieldProfileCode: 'GLOBAL_FIELD_PROFILE'
    };
    expect(resolveAccountFieldProfile(global).code).toBe('GLOBAL_FIELD_PROFILE');
  });

  it('rejects an unknown field profile instead of silently falling back to HQ', () => {
    const invalid = { ...krContext, countryCode: 'US', marketProfileCode: 'US_SALES', fieldProfileCode: 'UNKNOWN_FIELD_PROFILE' };
    expect(() => resolveAccountFieldProfile(invalid)).toThrow(FieldProfileResolutionError);
  });
});

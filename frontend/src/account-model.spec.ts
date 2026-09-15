import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_INTERFACE_FIELDS, DESKTOP_TABLE_FIELDS, MOBILE_BASIC_FIELDS, MOBILE_LIST_FIELDS, MOBILE_SUMMARY_FIELDS,
  filterAccounts, missingErpAccountFields
} from '@dio-crm/contracts';
import { SANDBOX_OWNER_ID, MOBILE_ACCOUNT_MQ, FORM_SECTIONS, erpMissingCodes, formFromAccount, toWritePayload } from './account-model';
import { seedAccounts } from './account-sandbox';

describe('Account interface catalog', () => {
  it('covers the ERP interface field codes from the definition sheet', () => {
    expect(ACCOUNT_INTERFACE_FIELDS.map(field => field.code)).toEqual([
      'co_cd', 'U_Key', 'hosp_nm', 'biz_no', 'ceo_nm', 'zip_cd', 'addr1', 'addr2', 'addr_prt',
      'medical_care_no', 'open_dt', 'doctor_no', 'email', 'sal_kd', 'tel', 'fax', 'homepage',
      'cust_cd', 'cust_nm', 'trade_bc', 'trade_bc_nm', 'use_yn', 'appr_bc', 'mgt_yn', 'stat_bc'
    ]);
  });

  it('keeps PC table fields different from the mobile list, and puts every interface field on mobile detail', () => {
    expect(MOBILE_LIST_FIELDS).toEqual(['account_name', 'hospital_address']);
    expect([...MOBILE_SUMMARY_FIELDS]).toEqual(['erp_customer_code', 'account_status', 'account_grade', 'integration_status', 'owner_name']);
    expect([...MOBILE_BASIC_FIELDS]).toEqual(ACCOUNT_INTERFACE_FIELDS.map(field => field.code));
    expect(DESKTOP_TABLE_FIELDS).toContain('business_no');
    expect(DESKTOP_TABLE_FIELDS).toContain('provider_no');
    expect([...MOBILE_LIST_FIELDS]).not.toContain('business_no');
  });

  it('uses a phone-first media query so landscape phones do not get the PC table UI', () => {
    expect(MOBILE_ACCOUNT_MQ).toContain('max-width: 920px');
    expect(MOBILE_ACCOUNT_MQ).toContain('pointer: coarse');
  });

  it('puts every interface field into the account form/detail sections', () => {
    expect(FORM_SECTIONS.flatMap(section => [...section.codes]).sort()).toEqual(
      [...ACCOUNT_INTERFACE_FIELDS.map(field => field.code)].sort()
    );
  });

  it('requires outbound ERP fields from the interface definition', () => {
    expect(missingErpAccountFields({ company_code: 'DIO', erp_approved_yn: false })).toEqual([
      'U_Key', 'hosp_nm', 'biz_no', 'ceo_nm', 'zip_cd', 'addr1', 'addr_prt',
      'medical_care_no', 'open_dt', 'email', 'sal_kd', 'tel'
    ]);
  });
});

describe('Account test data and filters', () => {
  it('uses mock account names and hospital addresses for list testing', () => {
    expect(seedAccounts.map(x => x.account_name)).toContain('에스치과의원');
    expect(seedAccounts.map(x => x.account_name)).toContain('서울더블유치과-강남구한의택');
    const es = seedAccounts.find(x => x.account_name === '에스치과의원')!;
    expect(es.account_status).toBe('NON_TRADING_OPP');
    expect(es.phone).toBe('054-743-7582');
    expect(es.account_type).toBe('BC505600');
    expect(es.integration_status).toBe('NOT_REQUESTED');
  });

  it('blocks ERP request when 에스치과의원 is missing required interface fields', () => {
    const es = seedAccounts.find(x => x.account_name === '에스치과의원')!;
    expect(erpMissingCodes(es)).toEqual(expect.arrayContaining(['U_Key', 'zip_cd', 'medical_care_no', 'email']));
  });

  it('allows ERP request for a fully filled mock account', () => {
    const filled = seedAccounts.find(x => x.account_name === '서울더블유치과-강남구한의택')!;
    expect(erpMissingCodes(filled)).toEqual([]);
  });

  it('filters mine vs all using owner_user_id', () => {
    const mine = filterAccounts(seedAccounts, { scope: 'mine', ownerUserId: SANDBOX_OWNER_ID });
    const all = filterAccounts(seedAccounts, { scope: 'all', ownerUserId: SANDBOX_OWNER_ID });
    expect(mine.every(x => x.owner_user_id === SANDBOX_OWNER_ID)).toBe(true);
    expect(all.some(x => x.owner_user_id !== SANDBOX_OWNER_ID)).toBe(true);
    expect(all).toHaveLength(seedAccounts.length);
  });

  it('round-trips actual interface fields through the form payload', () => {
    const source = seedAccounts.find(x => x.account_name === '디오치과_테스트_8')!;
    const payload = toWritePayload(formFromAccount(source));
    expect(payload.hospitalAddress).toBe('부산광역시 해운대구 센텀서로 66');
    expect(payload.accountType).toBe('BC505800');
    expect(payload.providerNo).toBe('61710008');
    expect(payload.encryptedProviderNo).toBe('ENC-61710008');
    expect(payload.businessNo).toBe('617-85-10008');
  });
});

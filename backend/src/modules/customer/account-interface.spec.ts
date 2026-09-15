import { missingErpAccountFields } from '@dio-crm/contracts';

describe('ERP account interface required fields', () => {
  it('uses interface codes instead of CRM-only field names', () => {
    const missing = missingErpAccountFields({
      company_code: 'DIO',
      erp_approved_yn: false,
      business_name: '에스치과의원',
      phone: '054-743-7582',
      account_type: 'BC505600'
    });
    expect(missing).toEqual(expect.arrayContaining(['U_Key', 'biz_no', 'ceo_nm', 'zip_cd', 'addr1', 'addr_prt', 'medical_care_no', 'open_dt', 'email']));
    expect(missing).not.toContain('co_cd');
    expect(missing).not.toContain('hosp_nm');
    expect(missing).not.toContain('tel');
    expect(missing).not.toContain('sal_kd');
  });

  it('passes when all outbound required fields are present', () => {
    expect(missingErpAccountFields({
      company_code: 'DIO',
      erp_approved_yn: false,
      encrypted_provider_no: 'ENC-1',
      business_name: '서울더블유치과',
      business_no: '211-88-12345',
      ceo_name: '한의택',
      zip_code: '06280',
      address_line1: '서울특별시 강남구 대치동 1021-6,7',
      hospital_address: '서울특별시 강남구 대치동 1021-6,7 201',
      provider_no: '21123456',
      open_date: '2012-04-20',
      tax_email: 'doubleu@example.com',
      account_type: 'BC505600',
      phone: '02-555-1201'
    })).toEqual([]);
  });
});

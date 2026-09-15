import type { AccountFieldProfile } from './types';

export const HQ_ACCOUNT_FIELD_PROFILE: AccountFieldProfile = {
  code: 'HQ_FIELD_PROFILE',
  entity: 'account',
  sections: [
    {
      code: 'identity',
      titleKey: 'account.sections.identity',
      order: 10,
      visible: true,
      fields: [
        { code: 'co_cd', visible: true, readonly: true }
      ]
    },
    {
      code: 'hira',
      titleKey: 'account.sections.hira',
      order: 20,
      visible: true,
      fields: [
        { code: 'U_Key', visible: true },
        { code: 'hosp_nm', visible: true },
        { code: 'biz_no', visible: true },
        { code: 'medical_care_no', visible: true },
        { code: 'open_dt', visible: true },
        { code: 'doctor_no', visible: true }
      ]
    },
    {
      code: 'address',
      titleKey: 'account.sections.address',
      order: 30,
      visible: true,
      fields: [
        { code: 'zip_cd', visible: true },
        { code: 'addr1', visible: true },
        { code: 'addr2', visible: true },
        { code: 'addr_prt', visible: true }
      ]
    },
    {
      code: 'basic',
      titleKey: 'account.sections.basic',
      order: 40,
      visible: true,
      fields: [
        { code: 'ceo_nm', visible: true },
        { code: 'email', visible: true },
        { code: 'sal_kd', visible: true },
        { code: 'tel', visible: true },
        { code: 'fax', visible: true },
        { code: 'homepage', visible: true }
      ]
    },
    {
      code: 'erp',
      titleKey: 'account.sections.erp',
      order: 50,
      visible: true,
      fields: [
        { code: 'cust_cd', visible: true, readonly: true },
        { code: 'cust_nm', visible: true, readonly: true },
        { code: 'trade_bc', visible: true, readonly: true },
        { code: 'trade_bc_nm', visible: true, readonly: true }
      ]
    },
    {
      code: 'manage',
      titleKey: 'account.sections.manage',
      order: 60,
      visible: true,
      fields: [
        { code: 'use_yn', visible: true },
        { code: 'appr_bc', visible: true, readonly: true },
        { code: 'mgt_yn', visible: true },
        { code: 'stat_bc', visible: true }
      ]
    }
  ]
};

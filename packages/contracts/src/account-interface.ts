export type AccountScope = 'managed' | 'mine' | 'all';
export type AccountTypeCode = 'BC505600' | 'BC505800';
export type ErpTradeCode = 'BC5110' | 'BC5111' | 'BC5112' | 'BC5113' | 'BC5114' | 'BC5115' | 'BC5116';
export type ErpApprovalCode = 'CM840100' | 'CM840500';
export type AccountStatCode = '0' | '1' | '2' | '3';

export type AccountInterfaceField = {
  code: string;
  nameKo: string;
  nameEn: string;
  crmField: keyof AccountRecord | null;
  requiredOut: boolean;
  direction: 'OUT' | 'IN' | 'DERIVED';
  group: 'identity' | 'hira' | 'address' | 'contact' | 'erp' | 'manage';
};

export type AccountRecord = {
  public_id: string;
  account_name: string;
  account_status: string;
  account_grade?: string | null;
  business_no?: string | null;
  business_name?: string | null;
  ceo_name?: string | null;
  phone?: string | null;
  fax?: string | null;
  homepage?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  hospital_address?: string | null;
  zip_code?: string | null;
  tax_email?: string | null;
  provider_no?: string | null;
  encrypted_provider_no?: string | null;
  open_date?: string | null;
  doctor_license_no?: string | null;
  account_type?: string | null;
  erp_customer_code?: string | null;
  erp_approved_yn: boolean;
  integration_status: string;
  erp_trade_code?: string | null;
  erp_approval_code?: string | null;
  use_yn?: string | null;
  churn_risk_yn?: boolean | null;
  account_stat_code?: string | null;
  owner_user_id?: number | null;
  owner_name?: string | null;
  company_code?: string | null;
  updated_at?: string | null;
};

export const ACCOUNT_TYPE_CODES: Record<AccountTypeCode, string> = {
  BC505600: '의원',
  BC505800: '병원'
};

export const ERP_TRADE_CODES: Record<ErpTradeCode, string> = {
  BC5110: '거래중',
  BC5111: '거래중지',
  BC5112: '일시중지',
  BC5113: '폐업',
  BC5114: '승인대기(방문->정식)',
  BC5115: '등록/수정요청',
  BC5116: '영업본부 확인요청'
};

export const ERP_APPROVAL_CODES: Record<ErpApprovalCode, string> = {
  CM840100: '작성',
  CM840500: '승인(관리부서)'
};

export const ACCOUNT_STAT_CODES: Record<AccountStatCode, string> = {
  '0': '정상',
  '1': '신규',
  '2': '이탈',
  '3': '폐업'
};

export const ACCOUNT_INTERFACE_FIELDS: AccountInterfaceField[] = [
  { code: 'co_cd', nameKo: '법인코드', nameEn: 'Company code', crmField: 'company_code', requiredOut: true, direction: 'DERIVED', group: 'identity' },
  { code: 'U_Key', nameKo: '암호화요양기호', nameEn: 'Encrypted provider no', crmField: 'encrypted_provider_no', requiredOut: true, direction: 'OUT', group: 'hira' },
  { code: 'hosp_nm', nameKo: '사업자명', nameEn: 'Hospital / business name', crmField: 'business_name', requiredOut: true, direction: 'OUT', group: 'hira' },
  { code: 'biz_no', nameKo: '사업자번호', nameEn: 'Business no', crmField: 'business_no', requiredOut: true, direction: 'OUT', group: 'hira' },
  { code: 'ceo_nm', nameKo: '대표자명', nameEn: 'CEO', crmField: 'ceo_name', requiredOut: true, direction: 'OUT', group: 'contact' },
  { code: 'zip_cd', nameKo: '우편번호', nameEn: 'Zip code', crmField: 'zip_code', requiredOut: true, direction: 'OUT', group: 'address' },
  { code: 'addr1', nameKo: '주소1', nameEn: 'Address 1', crmField: 'address_line1', requiredOut: true, direction: 'OUT', group: 'address' },
  { code: 'addr2', nameKo: '주소2', nameEn: 'Address 2', crmField: 'address_line2', requiredOut: false, direction: 'OUT', group: 'address' },
  { code: 'addr_prt', nameKo: '병원주소', nameEn: 'Hospital address', crmField: 'hospital_address', requiredOut: true, direction: 'OUT', group: 'address' },
  { code: 'medical_care_no', nameKo: '요양기관번호', nameEn: 'Provider no', crmField: 'provider_no', requiredOut: true, direction: 'OUT', group: 'hira' },
  { code: 'open_dt', nameKo: '개원일자', nameEn: 'Open date', crmField: 'open_date', requiredOut: true, direction: 'OUT', group: 'hira' },
  { code: 'doctor_no', nameKo: '의사면허번호', nameEn: 'Doctor license', crmField: 'doctor_license_no', requiredOut: false, direction: 'OUT', group: 'hira' },
  { code: 'email', nameKo: '계산서 발행 이메일', nameEn: 'Tax email', crmField: 'tax_email', requiredOut: true, direction: 'OUT', group: 'contact' },
  { code: 'sal_kd', nameKo: '거래처유형', nameEn: 'Account type', crmField: 'account_type', requiredOut: true, direction: 'OUT', group: 'contact' },
  { code: 'tel', nameKo: '대표전화', nameEn: 'Phone', crmField: 'phone', requiredOut: true, direction: 'OUT', group: 'contact' },
  { code: 'fax', nameKo: '대표Fax', nameEn: 'Fax', crmField: 'fax', requiredOut: false, direction: 'OUT', group: 'contact' },
  { code: 'homepage', nameKo: '홈페이지', nameEn: 'Homepage', crmField: 'homepage', requiredOut: false, direction: 'OUT', group: 'contact' },
  { code: 'cust_cd', nameKo: '(E)거래처코드', nameEn: 'ERP customer code', crmField: 'erp_customer_code', requiredOut: false, direction: 'IN', group: 'erp' },
  { code: 'cust_nm', nameKo: '거래처 이름', nameEn: 'Account name', crmField: 'account_name', requiredOut: false, direction: 'IN', group: 'erp' },
  { code: 'trade_bc', nameKo: '(E)거래여부', nameEn: 'ERP trade status', crmField: 'erp_trade_code', requiredOut: false, direction: 'IN', group: 'erp' },
  { code: 'trade_bc_nm', nameKo: '거래여부명', nameEn: 'ERP trade status name', crmField: null, requiredOut: false, direction: 'DERIVED', group: 'erp' },
  { code: 'use_yn', nameKo: '사용여부', nameEn: 'In use', crmField: 'use_yn', requiredOut: false, direction: 'IN', group: 'manage' },
  { code: 'appr_bc', nameKo: '승인여부', nameEn: 'ERP approval', crmField: 'erp_approval_code', requiredOut: false, direction: 'IN', group: 'manage' },
  { code: 'mgt_yn', nameKo: '이탈가능', nameEn: 'Churn risk', crmField: 'churn_risk_yn', requiredOut: false, direction: 'IN', group: 'manage' },
  { code: 'stat_bc', nameKo: '거래처 상태코드', nameEn: 'Account stat code', crmField: 'account_stat_code', requiredOut: false, direction: 'IN', group: 'manage' }
];

export const MOBILE_LIST_FIELDS = ['account_name', 'hospital_address'] as const;
export const MOBILE_SUMMARY_FIELDS = ['erp_customer_code', 'account_status', 'account_grade', 'integration_status', 'owner_name'] as const;
export const MOBILE_BASIC_FIELDS = ACCOUNT_INTERFACE_FIELDS.map(field => field.code);
export const DESKTOP_TABLE_FIELDS = [
  'account_name', 'hospital_address', 'business_no', 'provider_no', 'account_type',
  'account_status', 'account_grade', 'erp_customer_code', 'integration_status', 'owner_name'
] as const;

export function fieldValue(account: Partial<AccountRecord>, crmField: keyof AccountRecord): string {
  const value = account[crmField];
  if (value === true) return '1';
  if (value === false || value == null) return '';
  return String(value).trim();
}

export function missingErpAccountFields(account: Partial<AccountRecord>, companyCode = 'DIO'): string[] {
  return ACCOUNT_INTERFACE_FIELDS.filter(field => {
    if (!field.requiredOut) return false;
    if (field.code === 'co_cd') return !String(account.company_code || companyCode).trim();
    if (!field.crmField) return false;
    return !fieldValue(account, field.crmField);
  }).map(field => field.code);
}

export function tradeStatusName(code?: string | null) {
  return code ? ERP_TRADE_CODES[code as ErpTradeCode] ?? code : '';
}

export function accountTypeName(code?: string | null) {
  return code ? ACCOUNT_TYPE_CODES[code as AccountTypeCode] ?? code : '';
}

export function filterAccounts<T extends AccountRecord>(
  rows: T[],
  input: { search?: string; scope?: AccountScope; ownerUserId?: number }
): T[] {
  const q = input.search?.trim().toLowerCase() ?? '';
  return rows.filter(row => {
    if (input.scope === 'mine' && row.owner_user_id !== input.ownerUserId) return false;
    if (input.scope === 'managed' && (row.use_yn === '0' || row.account_status === 'MERGED')) return false;
    if (!q) return true;
    return [
      row.account_name, row.business_name, row.business_no, row.phone, row.hospital_address,
      row.address, row.provider_no, row.erp_customer_code, row.ceo_name
    ].some(value => String(value ?? '').toLowerCase().includes(q));
  });
}

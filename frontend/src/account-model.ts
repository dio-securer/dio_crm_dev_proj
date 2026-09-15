import type { AccountSummary, AccountWriteInput } from '@dio-crm/contracts';
import {
  ACCOUNT_INTERFACE_FIELDS,
  filterAccounts,
  missingErpAccountFields,
  type AccountScope
} from '@dio-crm/contracts';

export const SANDBOX_OWNER_ID = 1;
export const STORAGE_KEY = 'dio_crm_test_accounts_v2';
export const MOBILE_ACCOUNT_MQ = '(max-width: 920px), ((hover: none) and (pointer: coarse) and (max-width: 1400px))';

export type AccountFormInput = {
  accountName: string;
  accountStatus: string;
  accountGrade: string;
  businessName: string;
  businessNo: string;
  ceoName: string;
  phone: string;
  fax: string;
  homepage: string;
  taxEmail: string;
  zipCode: string;
  addressLine1: string;
  addressLine2: string;
  hospitalAddress: string;
  providerNo: string;
  encryptedProviderNo: string;
  openDate: string;
  doctorLicenseNo: string;
  accountType: string;
  useYn: string;
  churnRiskYn: string;
  accountStatCode: string;
};

export const emptyForm = (): AccountFormInput => ({
  accountName: '',
  accountStatus: 'ACTIVE',
  accountGrade: 'GENERAL',
  businessName: '',
  businessNo: '',
  ceoName: '',
  phone: '',
  fax: '',
  homepage: '',
  taxEmail: '',
  zipCode: '',
  addressLine1: '',
  addressLine2: '',
  hospitalAddress: '',
  providerNo: '',
  encryptedProviderNo: '',
  openDate: '',
  doctorLicenseNo: '',
  accountType: 'BC505600',
  useYn: '1',
  churnRiskYn: '0',
  accountStatCode: '0'
});

export function formFromAccount(row: AccountSummary): AccountFormInput {
  return {
    accountName: row.account_name,
    accountStatus: row.account_status === 'MERGED' ? 'ACTIVE' : row.account_status,
    accountGrade: row.account_grade ?? 'GENERAL',
    businessName: row.business_name ?? '',
    businessNo: row.business_no ?? '',
    ceoName: row.ceo_name ?? '',
    phone: row.phone ?? '',
    fax: row.fax ?? '',
    homepage: row.homepage ?? '',
    taxEmail: row.tax_email ?? '',
    zipCode: row.zip_code ?? '',
    addressLine1: row.address_line1 ?? '',
    addressLine2: row.address_line2 ?? '',
    hospitalAddress: row.hospital_address ?? row.address ?? '',
    providerNo: row.provider_no ?? '',
    encryptedProviderNo: row.encrypted_provider_no ?? '',
    openDate: row.open_date ? String(row.open_date).slice(0, 10) : '',
    doctorLicenseNo: row.doctor_license_no ?? '',
    accountType: row.account_type || 'BC505600',
    useYn: row.use_yn ?? '1',
    churnRiskYn: row.churn_risk_yn ? '1' : '0',
    accountStatCode: row.account_stat_code || '0'
  };
}

export function toWritePayload(form: AccountFormInput): AccountWriteInput {
  const text = (value: string) => value.trim() || null;
  const hospitalAddress = text(form.hospitalAddress) ?? text(form.addressLine1);
  return {
    accountName: form.accountName.trim(),
    accountStatus: form.accountStatus as AccountWriteInput['accountStatus'],
    accountGrade: text(form.accountGrade),
    businessNo: text(form.businessNo),
    businessName: text(form.businessName),
    ceoName: text(form.ceoName),
    phone: text(form.phone),
    fax: text(form.fax),
    homepage: text(form.homepage),
    address: hospitalAddress,
    addressLine1: text(form.addressLine1),
    addressLine2: text(form.addressLine2),
    hospitalAddress,
    zipCode: text(form.zipCode),
    taxEmail: text(form.taxEmail),
    providerNo: text(form.providerNo),
    encryptedProviderNo: text(form.encryptedProviderNo),
    openDate: text(form.openDate),
    doctorLicenseNo: text(form.doctorLicenseNo),
    accountType: text(form.accountType),
    useYn: form.useYn || '1',
    churnRiskYn: form.churnRiskYn === '1',
    accountStatCode: text(form.accountStatCode)
  };
}

export function applyForm(row: AccountSummary, form: AccountFormInput): AccountSummary {
  const payload = toWritePayload(form);
  return {
    ...row,
    account_name: payload.accountName,
    account_status: payload.accountStatus ?? row.account_status,
    account_grade: payload.accountGrade ?? null,
    business_no: payload.businessNo ?? null,
    business_name: payload.businessName ?? null,
    ceo_name: payload.ceoName ?? null,
    phone: payload.phone ?? null,
    fax: payload.fax ?? null,
    homepage: payload.homepage ?? null,
    address: payload.address ?? null,
    address_line1: payload.addressLine1 ?? null,
    address_line2: payload.addressLine2 ?? null,
    hospital_address: payload.hospitalAddress ?? null,
    zip_code: payload.zipCode ?? null,
    tax_email: payload.taxEmail ?? null,
    provider_no: payload.providerNo ?? null,
    encrypted_provider_no: payload.encryptedProviderNo ?? null,
    open_date: payload.openDate ?? null,
    doctor_license_no: payload.doctorLicenseNo ?? null,
    account_type: payload.accountType ?? null,
    use_yn: payload.useYn ?? '1',
    churn_risk_yn: Boolean(payload.churnRiskYn),
    account_stat_code: payload.accountStatCode ?? null,
    updated_at: new Date().toISOString()
  };
}

export function listVisibleAccounts(rows: AccountSummary[], search: string, scope: AccountScope) {
  return filterAccounts(rows, { search, scope, ownerUserId: SANDBOX_OWNER_ID });
}

export function erpMissingCodes(row: AccountSummary) {
  return missingErpAccountFields({ ...row, company_code: row.company_code || 'DIO' });
}

export const ACCOUNT_STATUSES = ['ACTIVE', 'NEW', 'NON_TRADING', 'NON_TRADING_OPP', 'CHURN_RISK', 'CHURNED', 'CLOSED'] as const;

export const FORM_SECTIONS = [
  { id: 'identity', titleKey: 'account.sections.identity', codes: ['co_cd'] },
  { id: 'hira', titleKey: 'account.sections.hira', codes: ['U_Key', 'hosp_nm', 'biz_no', 'medical_care_no', 'open_dt', 'doctor_no'] },
  { id: 'address', titleKey: 'account.sections.address', codes: ['zip_cd', 'addr1', 'addr2', 'addr_prt'] },
  { id: 'basic', titleKey: 'account.sections.basic', codes: ['ceo_nm', 'email', 'sal_kd', 'tel', 'fax', 'homepage'] },
  { id: 'erp', titleKey: 'account.sections.erp', codes: ['cust_cd', 'cust_nm', 'trade_bc', 'trade_bc_nm'] },
  { id: 'manage', titleKey: 'account.sections.manage', codes: ['use_yn', 'appr_bc', 'mgt_yn', 'stat_bc'] }
] as const;

export function fieldsByCodes(codes: readonly string[]) {
  return codes.map(code => ACCOUNT_INTERFACE_FIELDS.find(field => field.code === code)).filter(Boolean);
}

export const CRM_FORM_KEY: Partial<Record<string, keyof AccountFormInput>> = {
  account_name: 'accountName',
  account_status: 'accountStatus',
  account_grade: 'accountGrade',
  business_name: 'businessName',
  business_no: 'businessNo',
  ceo_name: 'ceoName',
  phone: 'phone',
  fax: 'fax',
  homepage: 'homepage',
  tax_email: 'taxEmail',
  zip_code: 'zipCode',
  address_line1: 'addressLine1',
  address_line2: 'addressLine2',
  hospital_address: 'hospitalAddress',
  provider_no: 'providerNo',
  encrypted_provider_no: 'encryptedProviderNo',
  open_date: 'openDate',
  doctor_license_no: 'doctorLicenseNo',
  account_type: 'accountType',
  use_yn: 'useYn',
  churn_risk_yn: 'churnRiskYn',
  account_stat_code: 'accountStatCode'
};

export { ACCOUNT_INTERFACE_FIELDS, filterAccounts, missingErpAccountFields };
export type { AccountScope };

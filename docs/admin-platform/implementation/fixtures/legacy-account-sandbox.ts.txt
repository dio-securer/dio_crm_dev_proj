import type { AccountSummary } from '@dio-crm/contracts';
import { applyForm, listVisibleAccounts, SANDBOX_OWNER_ID, STORAGE_KEY, type AccountFormInput, type AccountScope } from './account-model';
import { missingErpAccountFields } from '@dio-crm/contracts';

const seedAccounts: AccountSummary[] = [
  {
    public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    account_name: '에스치과의원',
    account_status: 'NON_TRADING_OPP',
    account_grade: 'GENERAL',
    business_name: '에스치과의원',
    business_no: '514-12-34567',
    ceo_name: '박원장',
    phone: '054-743-7582',
    fax: null,
    homepage: null,
    address: '경상북도 구미시 송정대로 1',
    address_line1: '경상북도 구미시 송정대로 1',
    address_line2: null,
    hospital_address: '경상북도 구미시 송정대로 1',
    zip_code: null,
    tax_email: null,
    provider_no: null,
    encrypted_provider_no: null,
    open_date: '2018-03-01',
    doctor_license_no: null,
    account_type: 'BC505600',
    erp_customer_code: null,
    erp_approved_yn: false,
    integration_status: 'NOT_REQUESTED',
    erp_trade_code: null,
    erp_approval_code: 'CM840100',
    use_yn: '1',
    churn_risk_yn: false,
    account_stat_code: '1',
    owner_user_id: SANDBOX_OWNER_ID,
    owner_name: '박동원',
    company_code: 'DIO',
    updated_at: '2026-09-14T09:00:00.000Z'
  },
  {
    public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    account_name: 'MARCO ANTONIO OLVERA ESPINOSA',
    account_status: 'ACTIVE',
    account_grade: 'GENERAL',
    business_name: 'MARCO ANTONIO OLVERA ESPINOSA',
    business_no: 'XAXX010101000',
    ceo_name: 'Marco Antonio',
    phone: '+52-444-100-2000',
    hospital_address: 'Av. Parque Chapultepec 1235, Alpes, 78295 San Luis Potosi, S.L.P.',
    address: 'Av. Parque Chapultepec 1235, Alpes, 78295 San Luis Potosi, S.L.P.',
    address_line1: 'Av. Parque Chapultepec 1235',
    address_line2: 'Alpes, 78295 San Luis Potosi, S.L.P.',
    zip_code: '78295',
    tax_email: 'marco@example.com',
    provider_no: 'HIRA-MX-001',
    encrypted_provider_no: 'ENC-MX-001',
    open_date: '2015-06-12',
    account_type: 'BC505600',
    erp_customer_code: 'E10021',
    erp_approved_yn: true,
    integration_status: 'SUCCESS',
    erp_trade_code: 'BC5110',
    erp_approval_code: 'CM840500',
    use_yn: '1',
    churn_risk_yn: false,
    account_stat_code: '0',
    owner_user_id: SANDBOX_OWNER_ID,
    owner_name: '박동원',
    company_code: 'DIO',
    updated_at: '2026-09-13T10:00:00.000Z'
  },
  {
    public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    account_name: '서울더블유치과-강남구한의택',
    account_status: 'ACTIVE',
    account_grade: 'GENERAL',
    business_name: '서울더블유치과',
    business_no: '211-88-12345',
    ceo_name: '한의택',
    phone: '02-555-1201',
    hospital_address: '서울특별시 강남구 대치동 1021-6,7 201',
    address_line1: '서울특별시 강남구 대치동 1021-6,7',
    address_line2: '201',
    zip_code: '06280',
    tax_email: 'doubleu@example.com',
    provider_no: '21123456',
    encrypted_provider_no: 'ENC-21123456',
    open_date: '2012-04-20',
    account_type: 'BC505600',
    erp_customer_code: 'E88312',
    erp_approved_yn: true,
    integration_status: 'SUCCESS',
    erp_trade_code: 'BC5110',
    erp_approval_code: 'CM840500',
    use_yn: '1',
    churn_risk_yn: false,
    account_stat_code: '0',
    owner_user_id: SANDBOX_OWNER_ID,
    owner_name: '박동원',
    company_code: 'DIO',
    updated_at: '2026-09-11T08:20:00.000Z'
  },
  {
    public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    account_name: '서울디온치과의원-공주시김희원',
    account_status: 'ACTIVE',
    account_grade: 'GENERAL',
    business_name: '서울디온치과의원',
    business_no: '312-45-67890',
    ceo_name: '김희원',
    phone: '041-555-3300',
    hospital_address: '충청남도 공주시 봉황로 175, 3층(중동)',
    address_line1: '충청남도 공주시 봉황로 175',
    address_line2: '3층(중동)',
    zip_code: '32535',
    tax_email: 'dion@example.com',
    provider_no: '34111222',
    encrypted_provider_no: 'ENC-34111222',
    open_date: '2019-09-01',
    account_type: 'BC505600',
    erp_customer_code: null,
    erp_approved_yn: false,
    integration_status: 'REQUESTING',
    erp_trade_code: 'BC5115',
    erp_approval_code: 'CM840100',
    use_yn: '1',
    churn_risk_yn: false,
    account_stat_code: '0',
    owner_user_id: SANDBOX_OWNER_ID,
    owner_name: '박동원',
    company_code: 'DIO',
    updated_at: '2026-09-12T14:10:00.000Z'
  },
  {
    public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    account_name: '연치과의원-동대문구최진웅',
    account_status: 'CHURN_RISK',
    account_grade: 'GENERAL',
    business_name: '연치과의원',
    business_no: '110-81-45678',
    ceo_name: '최진웅',
    phone: '02-555-4420',
    hospital_address: '서울특별시 동대문구 천호대로 425, 3층(장안동)',
    address_line1: '서울특별시 동대문구 천호대로 425',
    address_line2: '3층(장안동)',
    zip_code: '02631',
    tax_email: 'yeon@example.com',
    provider_no: '11099887',
    encrypted_provider_no: 'ENC-11099887',
    open_date: '2010-01-15',
    account_type: 'BC505600',
    erp_customer_code: 'E22019',
    erp_approved_yn: true,
    integration_status: 'SUCCESS',
    erp_trade_code: 'BC5110',
    erp_approval_code: 'CM840500',
    use_yn: '1',
    churn_risk_yn: true,
    account_stat_code: '0',
    owner_user_id: SANDBOX_OWNER_ID,
    owner_name: '박동원',
    company_code: 'DIO',
    updated_at: '2026-09-09T11:40:00.000Z'
  },
  {
    public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
    account_name: '디오치과_테스트_8',
    account_status: 'ACTIVE',
    account_grade: 'GENERAL',
    business_name: '디오치과',
    business_no: '617-85-10008',
    ceo_name: '테스트원장',
    phone: '051-555-8008',
    hospital_address: '부산광역시 해운대구 센텀서로 66',
    address_line1: '부산광역시 해운대구 센텀서로 66',
    zip_code: '48058',
    tax_email: 'dio8@example.com',
    provider_no: '61710008',
    encrypted_provider_no: 'ENC-61710008',
    open_date: '2021-08-08',
    account_type: 'BC505800',
    erp_customer_code: 'E80008',
    erp_approved_yn: true,
    integration_status: 'SUCCESS',
    erp_trade_code: 'BC5110',
    erp_approval_code: 'CM840500',
    use_yn: '1',
    churn_risk_yn: false,
    account_stat_code: '0',
    owner_user_id: SANDBOX_OWNER_ID,
    owner_name: '박동원',
    company_code: 'DIO',
    updated_at: '2026-09-08T07:00:00.000Z'
  },
  {
    public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
    account_name: '[테스트] 센톨치과_10000',
    account_status: 'NON_TRADING',
    account_grade: 'GENERAL',
    business_name: '센톨치과',
    business_no: '101-86-10000',
    ceo_name: '센톨',
    phone: '02-555-1000',
    hospital_address: '서울시 강남구 선릉로',
    address_line1: '서울시 강남구 선릉로',
    zip_code: '06000',
    tax_email: 'sentol@example.com',
    provider_no: '10110000',
    encrypted_provider_no: 'ENC-10110000',
    open_date: '2016-11-11',
    account_type: 'BC505600',
    erp_customer_code: null,
    erp_approved_yn: false,
    integration_status: 'NOT_REQUESTED',
    use_yn: '1',
    churn_risk_yn: false,
    account_stat_code: '1',
    owner_user_id: 2,
    owner_name: '김지점',
    company_code: 'DIO',
    updated_at: '2026-09-07T16:00:00.000Z'
  }
];

function readAll(): AccountSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedAccounts));
      return seedAccounts;
    }
    const parsed = JSON.parse(raw) as AccountSummary[];
    return Array.isArray(parsed) && parsed[0]?.hospital_address !== undefined ? parsed : seedAccounts;
  } catch {
    return seedAccounts;
  }
}

function writeAll(rows: AccountSummary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listSandboxAccounts(search?: string, scope: AccountScope = 'managed'): AccountSummary[] {
  return listVisibleAccounts(readAll(), search ?? '', scope);
}

export function saveSandboxAccount(publicId: string | null, input: AccountFormInput): AccountSummary {
  const rows = readAll();
  if (input.businessNo.trim()) {
    const dup = rows.find(x => x.business_no === input.businessNo.trim() && x.public_id !== publicId);
    if (dup) throw new Error('이미 같은 사업자번호의 거래처가 있습니다.');
  }
  if (publicId) {
    const index = rows.findIndex(x => x.public_id === publicId);
    if (index < 0) throw new Error('거래처를 찾을 수 없습니다.');
    rows[index] = applyForm(rows[index], input);
    writeAll(rows);
    return rows[index];
  }
  const created = applyForm({
    public_id: crypto.randomUUID(),
    account_name: input.accountName,
    account_status: input.accountStatus,
    erp_approved_yn: false,
    integration_status: 'NOT_REQUESTED',
    owner_user_id: SANDBOX_OWNER_ID,
    owner_name: '박동원',
    company_code: 'DIO'
  }, input);
  writeAll([created, ...rows]);
  return created;
}

export function requestSandboxErp(publicId: string): AccountSummary {
  const rows = readAll();
  const index = rows.findIndex(x => x.public_id === publicId);
  if (index < 0) throw new Error('거래처를 찾을 수 없습니다.');
  const missing = missingErpAccountFields({ ...rows[index], company_code: 'DIO' });
  if (missing.length) throw new Error(`ERP 필수 항목 누락: ${missing.join(', ')}`);
  rows[index] = { ...rows[index], integration_status: 'REQUESTING', updated_at: new Date().toISOString() };
  writeAll(rows);
  return rows[index];
}

export { seedAccounts };

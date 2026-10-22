export type CustomerRecord = { public_id: string; version: number; [key: string]: unknown };
export type CustomerForm = Record<string, string | number | boolean | null>;
export type CustomerField = { key: string; source: string; group: string; type?: 'text' | 'number' | 'email' | 'date' | 'checkbox' | 'textarea'; required?: boolean; integer?: boolean };
export type CustomerOwner = { userId: number; name: string; organizationId?: number };
export type ConversionOptions = { accounts: CustomerRecord[]; contacts: CustomerRecord[]; opportunities: CustomerRecord[]; duplicates: CustomerRecord[]; owners: CustomerOwner[] };
export type ConversionResult = { leadPublicId: string; accountPublicId: string; contactPublicId: string | null; opportunityPublicId: string | null };
export type CustomerDetail = {
  account: CustomerRecord; contacts: CustomerRecord[]; opportunities: CustomerRecord[]; contracts: CustomerRecord[];
  orders: CustomerRecord[]; sales: CustomerRecord[]; services: CustomerRecord[]; timeline: CustomerRecord[];
  analytics: Record<string, number | boolean>; hospital: Record<string, unknown>; interfaces: CustomerRecord[]; permissions: string[];
};

export const LEAD_STAGES = ['NEW', 'FIRST_VISIT', 'KEYMAN_MEETING', 'CONTACT_EXCLUDED', 'CONVERTED'] as const;
export const LEAD_FIELDS: CustomerField[] = [
  { key: 'hospitalName', source: 'hospital_name', group: 'basic', required: true },
  { key: 'phone', source: 'phone', group: 'basic' }, { key: 'address', source: 'address', group: 'basic' },
  { key: 'businessNo', source: 'business_no', group: 'basic' },
  { key: 'keymanName', source: 'keyman_name', group: 'keyman' }, { key: 'keymanType', source: 'keyman_type', group: 'keyman' },
  { key: 'keymanMobile', source: 'keyman_mobile', group: 'keyman' }, { key: 'keymanEmail', source: 'keyman_email', group: 'keyman', type: 'email' },
  { key: 'school', source: 'school', group: 'keyman' }, { key: 'cohort', source: 'cohort', group: 'keyman' },
  { key: 'major', source: 'major', group: 'keyman' }, { key: 'keymanNote', source: 'keyman_note', group: 'keyman', type: 'textarea' },
  { key: 'hospitalSize', source: 'hospital_size', group: 'hospital', type: 'number', integer: true },
  { key: 'doctorCount', source: 'doctor_count', group: 'hospital', type: 'number', integer: true },
  { key: 'chairCount', source: 'chair_count', group: 'hospital', type: 'number', integer: true },
  { key: 'mainSystem', source: 'main_system', group: 'hospital' }, { key: 'subSystem', source: 'sub_system', group: 'hospital' },
  { key: 'mapExcluded', source: 'map_excluded_yn', group: 'exclusions', type: 'checkbox' },
  { key: 'hiraExcluded', source: 'hira_sync_exclude_yn', group: 'exclusions', type: 'checkbox' },
  { key: 'contactExcludeReason', source: 'contact_exclude_reason', group: 'exclusions' },
  { key: 'exclusionDetail', source: 'exclusion_detail', group: 'exclusions', type: 'textarea' }
];
export const HOSPITAL_FIELDS: CustomerField[] = [
  { key: 'hospitalSize', source: 'hospital_size', group: 'hospital', type: 'number', integer: true },
  { key: 'mainSystem', source: 'main_system', group: 'hospital' },
  { key: 'subSystem', source: 'sub_system', group: 'hospital' },
  { key: 'dioProductUsage', source: 'dio_product_usage', group: 'hospital', type: 'textarea' }
];
export const CONTACT_FIELDS: CustomerField[] = [
  { key: 'contactName', source: 'contact_name', group: 'contacts', required: true },
  { key: 'contactType', source: 'contact_type', group: 'contacts' },
  { key: 'mobile', source: 'mobile', group: 'contacts' }, { key: 'email', source: 'email', group: 'contacts', type: 'email' },
  { key: 'isKeyman', source: 'is_keyman', group: 'contacts', type: 'checkbox' },
  { key: 'school', source: 'school', group: 'contacts' }, { key: 'cohort', source: 'cohort', group: 'contacts' },
  { key: 'major', source: 'major', group: 'contacts' }, { key: 'note', source: 'note', group: 'contacts', type: 'textarea' }
];
export const LEDGER_FIELDS: CustomerField[] = [
  { key: 'accountName', source: 'account_name', group: 'basic', required: true },
  { key: 'phone', source: 'phone', group: 'basic' },
  { key: 'businessNo', source: 'business_no', group: 'basic' },
  { key: 'accountGrade', source: 'account_grade', group: 'basic' }
];
export function formFromRecord(fields: CustomerField[], row: Record<string, unknown> = {}): CustomerForm {
  return Object.fromEntries(fields.map(field => [field.key, field.type === 'checkbox' ? Boolean(row[field.source]) : String(row[field.source] ?? '')]));
}
export function formPayload(fields: CustomerField[], form: CustomerForm): Record<string, unknown> {
  return Object.fromEntries(fields.map(field => [field.key,
    field.type === 'checkbox' ? Boolean(form[field.key]) : field.type === 'number'
      ? form[field.key] === '' || form[field.key] === null ? null : Number(form[field.key]) : String(form[field.key] ?? '').trim()
  ]));
}
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
export function recordLabel(row: CustomerRecord): string {
  return String(row.account_name ?? row.hospital_name ?? row.contact_name ?? row.opportunity_name ?? row.contract_name ?? row.subject ?? row.public_id);
}

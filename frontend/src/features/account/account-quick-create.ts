import { emptyForm, type AccountFormInput } from '../../account-model';

const PROFILE_KEY = 'dio-crm:mock:account-profile-supplement:v1';

export const ACCOUNT_COUNTRIES = ['KR', 'US', 'MX', 'IN', 'PT', 'TR'] as const;
export type AccountCountryCode = typeof ACCOUNT_COUNTRIES[number];

export const ACCOUNT_OWNER_CODES = ['USER001', 'USER002', 'USER003'] as const;
export type AccountOwnerCode = typeof ACCOUNT_OWNER_CODES[number];

export const ACCOUNT_OWNER_NAMES: Record<AccountOwnerCode, string> = {
  USER001: '김지훈',
  USER002: '이서연',
  USER003: '박준호'
};

export type AccountQuickCreateDraft = {
  accountName: string;
  country: AccountCountryCode | '';
  accountType: string;
  phone: string;
  ownerCode: AccountOwnerCode | '';
  address: string;
};

export const EMPTY_ACCOUNT_QUICK_CREATE: AccountQuickCreateDraft = {
  accountName: '',
  country: '',
  accountType: 'BC505600',
  phone: '',
  ownerCode: '',
  address: ''
};

type AccountProfileSupplement = {
  accountId: string;
  country: AccountCountryCode;
  ownerCode: AccountOwnerCode;
  ownerName: string;
};

let profileMemory: AccountProfileSupplement[] = [];

function readProfiles(): AccountProfileSupplement[] {
  try {
    const raw = globalThis.localStorage?.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AccountProfileSupplement[];
      if (Array.isArray(parsed)) {
        profileMemory = parsed;
        return parsed;
      }
    }
  } catch {
    // memory fallback
  }
  return profileMemory;
}

function writeProfiles(rows: AccountProfileSupplement[]) {
  profileMemory = rows;
  try {
    globalThis.localStorage?.setItem(PROFILE_KEY, JSON.stringify(rows));
  } catch {
    // memory fallback is sufficient for tests/non-browser runtimes
  }
}

export function accountQuickDraftToForm(draft: AccountQuickCreateDraft): AccountFormInput {
  return {
    ...emptyForm(),
    accountName: draft.accountName.trim(),
    businessName: draft.accountName.trim(),
    accountType: draft.accountType,
    phone: draft.phone.trim(),
    hospitalAddress: draft.address.trim(),
    addressLine1: draft.address.trim()
  };
}

export function saveAccountProfileSupplement(accountId: string, draft: AccountQuickCreateDraft) {
  if (!draft.country || !draft.ownerCode) return;
  const ownerName = ACCOUNT_OWNER_NAMES[draft.ownerCode];
  const next: AccountProfileSupplement = {
    accountId,
    country: draft.country,
    ownerCode: draft.ownerCode,
    ownerName
  };
  const rows = readProfiles();
  writeProfiles([next, ...rows.filter(row => row.accountId !== accountId)]);
}

export function getAccountProfileSupplement(accountId: string): AccountProfileSupplement | null {
  return readProfiles().find(row => row.accountId === accountId) ?? null;
}

export function accountCountryOverride(accountId: string): AccountCountryCode | undefined {
  return getAccountProfileSupplement(accountId)?.country;
}

export function accountOwnerOverride(accountId: string): string | undefined {
  return getAccountProfileSupplement(accountId)?.ownerName;
}

export function resetAccountProfileSupplements() {
  profileMemory = [];
  try {
    globalThis.localStorage?.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}

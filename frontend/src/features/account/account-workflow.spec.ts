import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyForm, STORAGE_KEY } from '../../account-model';
import { listSandboxAccounts, saveSandboxAccount } from '../../account-sandbox';
import {
  ACCOUNT_OWNER_NAMES,
  accountCountryOverride,
  accountOwnerOverride,
  accountQuickDraftToForm,
  resetAccountProfileSupplements,
  saveAccountProfileSupplement
} from './account-quick-create';
import {
  advanceAccountErpMock,
  getAccountErpMockWorkflow,
  requestAccountErpMock,
  resetAccountErpMockWorkflows
} from './account-erp-mock';
import {
  loadAccountListState,
  loadAccountPageState,
  saveAccountListState,
  saveAccountPageState
} from './account-view-state';

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear() { data.clear(); },
    getItem(key: string) { return data.has(key) ? data.get(key)! : null; },
    key(index: number) { return [...data.keys()][index] ?? null; },
    removeItem(key: string) { data.delete(key); },
    setItem(key: string, value: string) { data.set(key, String(value)); }
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
  vi.stubGlobal('sessionStorage', createMemoryStorage());
});

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.clear();
  resetAccountProfileSupplements();
  resetAccountErpMockWorkflows();
  vi.unstubAllGlobals();
});

describe('Account A+B workflow', () => {
  it('maps quick create input and preserves country/owner supplement', () => {
    const draft = {
      accountName: 'Global Dental',
      country: 'US' as const,
      accountType: 'BC505600',
      phone: '+1-555-0100',
      ownerCode: 'USER001' as const,
      address: '12 Market St'
    };
    const form = accountQuickDraftToForm(draft);
    const account = saveSandboxAccount(null, form);
    saveAccountProfileSupplement(account.public_id, draft);

    expect(form).toMatchObject({ accountName: 'Global Dental', phone: '+1-555-0100', hospitalAddress: '12 Market St' });
    expect(accountCountryOverride(account.public_id)).toBe('US');
    expect(accountOwnerOverride(account.public_id)).toBe(ACCOUNT_OWNER_NAMES.USER001);
  });

  it('advances ERP mock workflow from request to review to success', () => {
    const account = saveSandboxAccount(null, {
      ...emptyForm(),
      accountName: 'ERP Ready Dental',
      businessName: 'ERP Ready Dental',
      businessNo: '123-45-67890',
      ceoName: 'CEO',
      phone: '02-555-1000',
      taxEmail: 'erp@example.com',
      zipCode: '06280',
      addressLine1: 'Seoul 1',
      hospitalAddress: 'Seoul 1',
      providerNo: 'PROVIDER-1',
      encryptedProviderNo: 'ENC-PROVIDER-1',
      openDate: '2026-01-01',
      accountType: 'BC505600'
    });

    expect(requestAccountErpMock(account.public_id).status).toBe('REQUESTING');
    expect(advanceAccountErpMock(account.public_id).status).toBe('REVIEWING');
    expect(advanceAccountErpMock(account.public_id).status).toBe('SUCCESS');
    expect(getAccountErpMockWorkflow(account.public_id).status).toBe('SUCCESS');

    const stored = listSandboxAccounts('', 'all').find(row => row.public_id === account.public_id);
    expect(stored?.erp_approved_yn).toBe(true);
    expect(stored?.integration_status).toBe('SUCCESS');
    expect(stored?.erp_customer_code).toMatch(/^MOCK-/);
  });

  it('restores list and page state from session storage', () => {
    saveAccountListState('list-test', {
      filters: { search: 'dental', country: 'US', accountType: 'ALL', grade: 'ALL', status: 'ACTIVE', erpStatus: 'ALL', lastActivity: '30' },
      page: 3,
      pageSize: 20,
      scrollTop: 240
    });
    saveAccountPageState('page-test', { scope: 'mine', selectedId: 'ACC-1', tab: 'activity', mobileDetailOpen: true });

    expect(loadAccountListState('list-test')).toMatchObject({ page: 3, pageSize: 20, scrollTop: 240, filters: { search: 'dental', country: 'US', status: 'ACTIVE' } });
    expect(loadAccountPageState('page-test', { scope: 'managed', selectedId: null, tab: 'summary', mobileDetailOpen: false })).toEqual({
      scope: 'mine', selectedId: 'ACC-1', tab: 'activity', mobileDetailOpen: true
    });
  });
});

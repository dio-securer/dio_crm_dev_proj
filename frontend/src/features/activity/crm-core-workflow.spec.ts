import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyForm, STORAGE_KEY } from '../../account-model';
import { saveSandboxAccount } from '../../account-sandbox';
import { addAccountContact, listAccountContacts, resetAccountRelationMocks } from '../account/account-relations-mock';
import { addMockOpportunity, listMockOpportunities, resetMockOpportunities, updateMockOpportunity } from '../opportunity/opportunity-mock';
import { addUnifiedActivity, listUnifiedActivities } from './activity-workspace-mock';

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
  resetAccountRelationMocks();
  resetMockOpportunities();
  vi.unstubAllGlobals();
});

describe('CRM core A+B integration', () => {
  it('creates Contact and Opportunity under one Account', () => {
    const account = saveSandboxAccount(null, { ...emptyForm(), accountName: 'Core Dental', phone: '02-111-2222' });
    const contact = addAccountContact(account.public_id, { name: 'Jane', role: 'Keyman', phone: '010-1111-2222', email: 'jane@example.com' });
    const opportunity = addMockOpportunity({ accountId: account.public_id, name: 'Implant Deal', expectedAmount: 30000000 });

    expect(listAccountContacts(account.public_id).some(row => row.id === contact.id)).toBe(true);
    expect(listMockOpportunities(account.public_id).some(row => row.id === opportunity.id)).toBe(true);

    updateMockOpportunity(opportunity.id, { stage: 'NEGOTIATION', probability: 70 });
    expect(listMockOpportunities(account.public_id)[0]).toMatchObject({ stage: 'NEGOTIATION', probability: 70 });
  });

  it('shows Account activity in the unified Activity workspace', () => {
    const account = saveSandboxAccount(null, { ...emptyForm(), accountName: 'Activity Dental', phone: '02-333-4444' });
    const activity = addUnifiedActivity({
      source: 'ACCOUNT',
      targetId: account.public_id,
      type: 'MEETING',
      subject: 'Demo meeting',
      note: 'Follow-up required',
      occurredAt: '2026-09-16T07:00:00.000Z'
    });

    expect(activity.source).toBe('ACCOUNT');
    expect(listUnifiedActivities().some(row => row.id === activity.id && row.targetName === 'Activity Dental')).toBe(true);
  });
});

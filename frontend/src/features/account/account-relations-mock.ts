import { createPublicId } from '../../account-sandbox';
import { listMockConvertedContacts } from '../lead/lead-conversion-mock';
import { listMockOpportunities } from '../opportunity/opportunity-mock';

const CONTACT_KEY = 'dio-crm:mock:account-contacts:v1';
const ACTIVITY_KEY = 'dio-crm:mock:account-activities:v1';

export type AccountMockContact = {
  id: string;
  accountId: string;
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  source: 'MANUAL' | 'LEAD_CONVERSION';
  createdAt: string;
};

export type AccountMockOpportunity = {
  id: string;
  accountId: string;
  name: string;
  stage: string;
  expectedAmount?: number | null;
  ownerName: string;
  sourceLeadId?: string;
  createdAt: string;
};

export type AccountActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'VISIT' | 'NOTE';

export type AccountMockActivity = {
  id: string;
  accountId: string;
  type: AccountActivityType;
  subject: string;
  note?: string | null;
  ownerName: string;
  occurredAt: string;
  createdAt: string;
};

export type AccountRelationSummary = {
  contacts: AccountMockContact[];
  opportunities: AccountMockOpportunity[];
  activities: AccountMockActivity[];
  contactCount: number;
  opportunityCount: number;
  activityCount: number;
  latestActivityAt?: string;
};

let contactMemory: AccountMockContact[] = [];
let activityMemory: AccountMockActivity[] = [];

function readList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Keep memory fallback for test/runtime environments without localStorage.
  }
  return fallback;
}

function writeList<T>(key: string, rows: T[]) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(rows));
  } catch {
    // Memory fallback is maintained by callers.
  }
}

function readManualContacts() {
  contactMemory = readList(CONTACT_KEY, contactMemory);
  return contactMemory;
}

function writeManualContacts(rows: AccountMockContact[]) {
  contactMemory = rows;
  writeList(CONTACT_KEY, rows);
}

function readActivities() {
  activityMemory = readList(ACTIVITY_KEY, activityMemory);
  return activityMemory;
}

function writeActivities(rows: AccountMockActivity[]) {
  activityMemory = rows;
  writeList(ACTIVITY_KEY, rows);
}

export function listAccountContacts(accountId: string): AccountMockContact[] {
  const converted = listMockConvertedContacts(accountId).map(row => ({
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    source: 'LEAD_CONVERSION' as const,
    createdAt: row.createdAt
  }));
  const manual = readManualContacts().filter(row => row.accountId === accountId);
  const seen = new Set<string>();
  return [...manual, ...converted]
    .filter(row => !seen.has(row.id) && seen.add(row.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addAccountContact(accountId: string, input: Omit<AccountMockContact, 'id' | 'accountId' | 'source' | 'createdAt'>): AccountMockContact {
  const row: AccountMockContact = {
    id: createPublicId(),
    accountId,
    name: input.name.trim(),
    role: input.role.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    source: 'MANUAL',
    createdAt: new Date().toISOString()
  };
  writeManualContacts([row, ...readManualContacts()]);
  return row;
}

export function listAccountOpportunities(accountId: string): AccountMockOpportunity[] {
  return listMockOpportunities(accountId).map(row => ({
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    stage: row.stage,
    expectedAmount: row.expectedAmount,
    ownerName: row.ownerName,
    sourceLeadId: row.sourceLeadId,
    createdAt: row.createdAt
  }));
}

export function listAccountActivities(accountId: string): AccountMockActivity[] {
  return readActivities()
    .filter(row => row.accountId === accountId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function addAccountActivity(
  accountId: string,
  ownerName: string,
  input: { type: AccountActivityType; subject: string; note?: string; occurredAt?: string }
): AccountMockActivity {
  const now = new Date().toISOString();
  const row: AccountMockActivity = {
    id: createPublicId(),
    accountId,
    type: input.type,
    subject: input.subject.trim(),
    note: input.note?.trim() || null,
    ownerName,
    occurredAt: input.occurredAt || now,
    createdAt: now
  };
  writeActivities([row, ...readActivities()]);
  return row;
}

export function getAccountRelationSummary(accountId: string): AccountRelationSummary {
  const contacts = listAccountContacts(accountId);
  const opportunities = listAccountOpportunities(accountId);
  const activities = listAccountActivities(accountId);
  return {
    contacts,
    opportunities,
    activities,
    contactCount: contacts.length,
    opportunityCount: opportunities.length,
    activityCount: activities.length,
    latestActivityAt: activities[0]?.occurredAt
  };
}

export function resetAccountRelationMocks() {
  contactMemory = [];
  activityMemory = [];
  try {
    globalThis.localStorage?.removeItem(CONTACT_KEY);
    globalThis.localStorage?.removeItem(ACTIVITY_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

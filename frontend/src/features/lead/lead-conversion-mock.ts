import { emptyForm } from '../../account-model';
import { createPublicId, listSandboxAccounts, saveSandboxAccount, setSandboxAccountOwner } from '../../account-sandbox';
import type { LeadConversionResult } from './lead-model';

const CONVERSION_KEY = 'dio-crm:mock:lead-conversions:v1';
const CONTACT_KEY = 'dio-crm:mock:lead-conversion-contacts:v1';
const OPPORTUNITY_KEY = 'dio-crm:mock:lead-conversion-opportunities:v1';

export type LeadConversionSource = {
  leadId: string;
  organizationName: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  country?: string | null;
  ownerName: string;
  expectedAmount?: number | null;
};

export type LeadConversionOptions = {
  accountMode: 'NEW' | 'EXISTING';
  existingAccountId?: string;
  createContact: boolean;
  createOpportunity: boolean;
  opportunityName?: string;
};

export type MockConvertedContact = {
  id: string;
  sourceLeadId: string;
  accountId: string;
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
};

export type MockConvertedOpportunity = {
  id: string;
  sourceLeadId: string;
  accountId: string;
  name: string;
  stage: 'IDENTIFIED';
  expectedAmount?: number | null;
  ownerName: string;
  createdAt: string;
};

type StoredConversion = LeadConversionResult & { leadId: string };

let conversionMemory: StoredConversion[] = [];
let contactMemory: MockConvertedContact[] = [];
let opportunityMemory: MockConvertedOpportunity[] = [];

function readList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // use memory fallback
  }
  return fallback;
}

function writeList<T>(key: string, rows: T[]) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(rows));
  } catch {
    // memory fallback is kept by callers
  }
}

function readConversions() {
  conversionMemory = readList(CONVERSION_KEY, conversionMemory);
  return conversionMemory;
}

function writeConversions(rows: StoredConversion[]) {
  conversionMemory = rows;
  writeList(CONVERSION_KEY, rows);
}

function readContacts() {
  contactMemory = readList(CONTACT_KEY, contactMemory);
  return contactMemory;
}

function writeContacts(rows: MockConvertedContact[]) {
  contactMemory = rows;
  writeList(CONTACT_KEY, rows);
}

function readOpportunities() {
  opportunityMemory = readList(OPPORTUNITY_KEY, opportunityMemory);
  return opportunityMemory;
}

function writeOpportunities(rows: MockConvertedOpportunity[]) {
  opportunityMemory = rows;
  writeList(OPPORTUNITY_KEY, rows);
}

export function getMockLeadConversion(leadId: string): LeadConversionResult | null {
  const found = readConversions().find(row => row.leadId === leadId);
  if (!found) return null;
  const { leadId: _leadId, ...result } = found;
  return result;
}

export function listMockConvertedContacts(accountId?: string): MockConvertedContact[] {
  const rows = readContacts();
  return accountId ? rows.filter(row => row.accountId === accountId) : rows;
}

export function listMockConvertedOpportunities(accountId?: string): MockConvertedOpportunity[] {
  const rows = readOpportunities();
  return accountId ? rows.filter(row => row.accountId === accountId) : rows;
}

export function convertLeadToMock(source: LeadConversionSource, options: LeadConversionOptions): LeadConversionResult {
  const existing = getMockLeadConversion(source.leadId);
  if (existing) throw new Error('LEAD_ALREADY_CONVERTED');

  const now = new Date().toISOString();
  let accountId = '';
  let accountName = '';

  if (options.accountMode === 'EXISTING') {
    if (!options.existingAccountId) throw new Error('ACCOUNT_REQUIRED');
    const account = listSandboxAccounts('', 'all').find(row => row.public_id === options.existingAccountId);
    if (!account) throw new Error('ACCOUNT_NOT_FOUND');
    accountId = account.public_id;
    accountName = account.account_name;
  } else {
    const address = [source.country, source.address].filter(Boolean).join(' · ');
    const created = saveSandboxAccount(null, {
      ...emptyForm(),
      accountName: source.organizationName,
      accountStatus: 'NEW',
      businessName: source.organizationName,
      ceoName: source.contactName,
      phone: source.phone ?? '',
      addressLine1: address,
      hospitalAddress: address,
      accountType: 'BC505600'
    });
    const owned = setSandboxAccountOwner(created.public_id, source.ownerName);
    accountId = owned.public_id;
    accountName = owned.account_name;
  }

  let contactId: string | undefined;
  if (options.createContact) {
    contactId = createPublicId();
    const contact: MockConvertedContact = {
      id: contactId,
      sourceLeadId: source.leadId,
      accountId,
      name: source.contactName,
      role: 'PRIMARY',
      phone: source.phone ?? null,
      email: source.email ?? null,
      createdAt: now
    };
    writeContacts([contact, ...readContacts()]);
  }

  let opportunityId: string | undefined;
  if (options.createOpportunity) {
    opportunityId = createPublicId();
    const opportunity: MockConvertedOpportunity = {
      id: opportunityId,
      sourceLeadId: source.leadId,
      accountId,
      name: options.opportunityName?.trim() || `${source.organizationName} Opportunity`,
      stage: 'IDENTIFIED',
      expectedAmount: source.expectedAmount ?? null,
      ownerName: source.ownerName,
      createdAt: now
    };
    writeOpportunities([opportunity, ...readOpportunities()]);
  }

  const result: LeadConversionResult = { accountId, accountName, contactId, opportunityId, convertedAt: now };
  writeConversions([{ leadId: source.leadId, ...result }, ...readConversions()]);
  return result;
}

export function recordExternalLeadConversion(leadId: string, result: LeadConversionResult): LeadConversionResult {
  const existing = getMockLeadConversion(leadId);
  if (existing) return existing;
  writeConversions([{ leadId, ...result }, ...readConversions()]);
  return result;
}

export function resetLeadConversionMocks() {
  conversionMemory = [];
  contactMemory = [];
  opportunityMemory = [];
  try {
    globalThis.localStorage?.removeItem(CONVERSION_KEY);
    globalThis.localStorage?.removeItem(CONTACT_KEY);
    globalThis.localStorage?.removeItem(OPPORTUNITY_KEY);
  } catch {
    // ignore
  }
}

import { createPublicId, listSandboxAccounts } from '../../account-sandbox';
import { listMockConvertedOpportunities } from '../lead/lead-conversion-mock';

const MANUAL_KEY = 'dio-crm:mock:opportunities:v1';
const OVERRIDE_KEY = 'dio-crm:mock:opportunity-overrides:v1';

export const OPPORTUNITY_STAGES = ['IDENTIFIED', 'QUALIFIED', 'ANALYSIS', 'PROPOSAL', 'REVIEW', 'NEGOTIATION', 'WON', 'LOST', 'HOLD'] as const;
export type OpportunityStage = typeof OPPORTUNITY_STAGES[number];

export type OpportunityMockRecord = {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  stage: OpportunityStage;
  expectedAmount: number;
  probability: number;
  expectedCloseDate?: string | null;
  ownerName: string;
  source: 'MANUAL' | 'LEAD_CONVERSION';
  sourceLeadId?: string;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityCreateInput = {
  accountId: string;
  name: string;
  expectedAmount?: number;
  expectedCloseDate?: string;
  ownerName?: string;
};

type OpportunityOverride = Partial<Pick<OpportunityMockRecord, 'stage' | 'expectedAmount' | 'probability' | 'expectedCloseDate' | 'ownerName'>> & { id: string; updatedAt: string };

let manualMemory: OpportunityMockRecord[] = [];
let overrideMemory: OpportunityOverride[] = [];

function readList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Keep in-memory fallback for tests and non-browser runtimes.
  }
  return fallback;
}

function writeList<T>(key: string, rows: T[]) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(rows));
  } catch {
    // In-memory state remains authoritative when storage is unavailable.
  }
}

function readManual() {
  manualMemory = readList(MANUAL_KEY, manualMemory);
  return manualMemory;
}

function writeManual(rows: OpportunityMockRecord[]) {
  manualMemory = rows;
  writeList(MANUAL_KEY, rows);
}

function readOverrides() {
  overrideMemory = readList(OVERRIDE_KEY, overrideMemory);
  return overrideMemory;
}

function writeOverrides(rows: OpportunityOverride[]) {
  overrideMemory = rows;
  writeList(OVERRIDE_KEY, rows);
}

function accountLookup() {
  return new Map(listSandboxAccounts('', 'all').map(account => [account.public_id, account]));
}

function applyOverride(row: OpportunityMockRecord, override: OpportunityOverride | undefined): OpportunityMockRecord {
  return override ? { ...row, ...override, id: row.id, updatedAt: override.updatedAt } : row;
}

export function listMockOpportunities(accountId?: string): OpportunityMockRecord[] {
  const accounts = accountLookup();
  const overrides = new Map(readOverrides().map(row => [row.id, row]));
  const converted: OpportunityMockRecord[] = listMockConvertedOpportunities().map(row => {
    const account = accounts.get(row.accountId);
    const base: OpportunityMockRecord = {
      id: row.id,
      accountId: row.accountId,
      accountName: account?.account_name ?? row.accountId,
      name: row.name,
      stage: 'IDENTIFIED',
      expectedAmount: Number(row.expectedAmount ?? 0),
      probability: 10,
      expectedCloseDate: null,
      ownerName: row.ownerName,
      source: 'LEAD_CONVERSION',
      sourceLeadId: row.sourceLeadId,
      createdAt: row.createdAt,
      updatedAt: row.createdAt
    };
    return applyOverride(base, overrides.get(base.id));
  });
  const manual = readManual().map(row => applyOverride(row, overrides.get(row.id)));
  const seen = new Set<string>();
  return [...manual, ...converted]
    .filter(row => !seen.has(row.id) && seen.add(row.id))
    .filter(row => !accountId || row.accountId === accountId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function addMockOpportunity(input: OpportunityCreateInput): OpportunityMockRecord {
  const account = listSandboxAccounts('', 'all').find(row => row.public_id === input.accountId);
  if (!account) throw new Error('ACCOUNT_NOT_FOUND');
  if (!input.name.trim()) throw new Error('OPPORTUNITY_NAME_REQUIRED');
  const now = new Date().toISOString();
  const row: OpportunityMockRecord = {
    id: createPublicId(),
    accountId: account.public_id,
    accountName: account.account_name,
    name: input.name.trim(),
    stage: 'IDENTIFIED',
    expectedAmount: Math.max(0, Number(input.expectedAmount ?? 0)),
    probability: 10,
    expectedCloseDate: input.expectedCloseDate || null,
    ownerName: input.ownerName?.trim() || account.owner_name || '-',
    source: 'MANUAL',
    createdAt: now,
    updatedAt: now
  };
  writeManual([row, ...readManual()]);
  return row;
}

export function updateMockOpportunity(id: string, patch: Partial<Pick<OpportunityMockRecord, 'stage' | 'expectedAmount' | 'probability' | 'expectedCloseDate' | 'ownerName'>>): OpportunityMockRecord {
  const current = listMockOpportunities().find(row => row.id === id);
  if (!current) throw new Error('OPPORTUNITY_NOT_FOUND');
  const now = new Date().toISOString();
  const normalized = {
    ...patch,
    expectedAmount: patch.expectedAmount == null ? undefined : Math.max(0, Number(patch.expectedAmount)),
    probability: patch.probability == null ? undefined : Math.max(0, Math.min(100, Number(patch.probability)))
  };
  if (current.source === 'MANUAL') {
    const rows = readManual();
    const next = rows.map(row => row.id === id ? { ...row, ...normalized, updatedAt: now } : row);
    writeManual(next);
  }
  const previous = readOverrides().find(row => row.id === id);
  writeOverrides([{ ...previous, ...normalized, id, updatedAt: now }, ...readOverrides().filter(row => row.id !== id)]);
  const updated = listMockOpportunities().find(row => row.id === id);
  if (!updated) throw new Error('OPPORTUNITY_NOT_FOUND');
  return updated;
}

export function resetMockOpportunities() {
  manualMemory = [];
  overrideMemory = [];
  try {
    globalThis.localStorage?.removeItem(MANUAL_KEY);
    globalThis.localStorage?.removeItem(OVERRIDE_KEY);
  } catch {
    // ignore
  }
}

import { MOCK_LEAD_SEED } from './lead-mock-data';
import { MOCK_LEAD_OWNERS, type LeadQuickCreateInput, type LeadRecord, type LeadStage } from './lead-model';

const STORAGE_KEY = 'dio-crm:mock:leads:v2';

function cloneSeed(): LeadRecord[] {
  return JSON.parse(JSON.stringify(MOCK_LEAD_SEED)) as LeadRecord[];
}

export function loadMockLeads(): LeadRecord[] {
  if (typeof window === 'undefined') return cloneSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSeed();
    const parsed = JSON.parse(raw) as LeadRecord[];
    return Array.isArray(parsed) && parsed.length ? parsed : cloneSeed();
  } catch {
    return cloneSeed();
  }
}

export function saveMockLeads(rows: LeadRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function resetMockLeads(): LeadRecord[] {
  const rows = cloneSeed();
  saveMockLeads(rows);
  return rows;
}

function nextLeadNo(rows: LeadRecord[]): string {
  const year = new Date().getFullYear();
  const maxSeq = rows.reduce((max, row) => {
    const match = row.leadNo.match(/(\d{6})$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 100);
  return `L-${year}-${String(maxSeq + 1).padStart(6, '0')}`;
}

export function createMockLead(rows: LeadRecord[], input: LeadQuickCreateInput): LeadRecord[] {
  const now = new Date().toISOString();
  const owner = MOCK_LEAD_OWNERS.find(x => x.id === input.ownerUserId) ?? MOCK_LEAD_OWNERS[0];
  const newLead: LeadRecord = {
    leadId: `LD${Date.now()}`,
    leadNo: nextLeadNo(rows),
    leadName: input.leadName.trim(),
    organizationName: input.organizationName.trim(),
    organizationType: '치과의원',
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    region: input.country?.trim() || '-',
    stage: 'NEW',
    interestLevel: 'MEDIUM',
    source: input.source,
    ownerUserId: owner.id,
    ownerName: owner.name,
    tags: [],
    opportunityCount: 0,
    contacts: [],
    activities: [],
    noteSummary: '',
    createdAt: now,
    updatedAt: now
  };
  const next = [newLead, ...rows];
  saveMockLeads(next);
  return next;
}

export function changeMockLeadStage(rows: LeadRecord[], leadId: string, stage: LeadStage): LeadRecord[] {
  const now = new Date().toISOString();
  const next = rows.map(row => row.leadId === leadId ? { ...row, stage, updatedAt: now } : row);
  saveMockLeads(next);
  return next;
}

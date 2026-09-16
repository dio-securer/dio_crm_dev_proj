import { MOCK_LEAD_SEED } from './lead-mock-data';
import {
  MOCK_LEAD_OWNERS,
  type LeadActivityInput,
  type LeadConversionResult,
  type LeadHospitalScale,
  type LeadQuickCreateInput,
  type LeadRecord,
  type LeadStage
} from './lead-model';

const STORAGE_KEY = 'dio-crm:mock:leads:v2';

function hospitalTypeCode(value: string) {
  if (value === '치과병원') return 'DENTAL_HOSPITAL';
  if (value === '종합병원') return 'GENERAL_HOSPITAL';
  if (value === '치과의원') return 'CLINIC';
  if (['CLINIC', 'DENTAL_HOSPITAL', 'GENERAL_HOSPITAL', 'OTHER'].includes(value)) return value;
  return 'OTHER';
}

function defaultHospitalScale(row: LeadRecord, index: number): LeadHospitalScale {
  const seed = Number(row.leadId.replace(/\D/g, '').slice(-3)) || index + 1;
  const specialties = ['임플란트', '보철', '교정', '구강외과', '통합진료'];
  const hospital = row.organizationType.includes('병원');
  return {
    hospitalType: hospitalTypeCode(row.organizationType),
    doctorCount: hospital ? 5 + (seed % 6) : 1 + (seed % 4),
    chairCount: hospital ? 12 + (seed % 10) : 4 + (seed % 8),
    staffCount: hospital ? 20 + (seed % 18) : 6 + (seed % 14),
    mainSpecialty: row.tags[0] || specialties[seed % specialties.length]
  };
}

function normalizeRows(rows: LeadRecord[]): LeadRecord[] {
  return rows.map((row, index) => ({
    ...row,
    country: row.country || 'KR',
    region: row.region || '-',
    hospitalScale: row.hospitalScale
      ? { ...row.hospitalScale, hospitalType: hospitalTypeCode(row.hospitalScale.hospitalType) }
      : defaultHospitalScale(row, index),
    activities: [...(row.activities ?? [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  }));
}

function cloneSeed(): LeadRecord[] {
  return normalizeRows(JSON.parse(JSON.stringify(MOCK_LEAD_SEED)) as LeadRecord[]);
}

export function loadMockLeads(): LeadRecord[] {
  if (typeof window === 'undefined') return cloneSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSeed();
    const parsed = JSON.parse(raw) as LeadRecord[];
    return Array.isArray(parsed) && parsed.length ? normalizeRows(parsed) : cloneSeed();
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
    country: input.country?.trim() || 'KR',
    region: '-',
    address: input.address?.trim() || undefined,
    stage: 'NEW',
    interestLevel: 'MEDIUM',
    source: input.source,
    ownerUserId: owner.id,
    ownerName: owner.name,
    hospitalScale: {
      hospitalType: 'CLINIC',
      doctorCount: 1,
      chairCount: 4,
      staffCount: 6,
      mainSpecialty: ''
    },
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

export function updateMockLeadHospitalScale(rows: LeadRecord[], leadId: string, scale: LeadHospitalScale): LeadRecord[] {
  const now = new Date().toISOString();
  const next = rows.map(row => row.leadId === leadId ? { ...row, hospitalScale: { ...scale }, updatedAt: now } : row);
  saveMockLeads(next);
  return next;
}

export function addMockLeadActivity(rows: LeadRecord[], leadId: string, input: LeadActivityInput): LeadRecord[] {
  const now = new Date().toISOString();
  const next = rows.map(row => {
    if (row.leadId !== leadId) return row;
    const activity = {
      id: `ACT-${Date.now()}`,
      type: input.type,
      occurredAt: input.occurredAt,
      title: input.title,
      summary: input.summary,
      ownerName: row.ownerName
    };
    return {
      ...row,
      lastActivityAt: input.occurredAt,
      updatedAt: now,
      activities: [activity, ...row.activities].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    };
  });
  saveMockLeads(next);
  return next;
}

export function completeMockLeadConversion(rows: LeadRecord[], leadId: string, result: LeadConversionResult): LeadRecord[] {
  const next = rows.map(row => row.leadId === leadId ? {
    ...row,
    stage: 'CONVERTED' as LeadStage,
    convertedAccountId: result.accountId,
    convertedContactId: result.contactId,
    convertedOpportunityId: result.opportunityId,
    convertedAt: result.convertedAt,
    nextAction: undefined,
    nextActionAt: undefined,
    opportunityCount: row.opportunityCount + (result.opportunityId ? 1 : 0),
    updatedAt: result.convertedAt
  } : row);
  saveMockLeads(next);
  return next;
}

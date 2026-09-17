import type { LeadStatus, LeadSummary } from '@dio-crm/contracts';
import { createPublicId } from '../../account-sandbox';
import type { LeadActivity, LeadActivityInput, LeadConversionResult, LeadHospitalScale } from './lead-model';

const STORAGE_KEY = 'dio-crm:sandbox:global-leads';
const SUPPLEMENT_KEY = 'dio-crm:sandbox:global-lead-supplements';
let memoryStore: SandboxLeadSummary[] = [];
let supplementMemory: Record<string, LeadSupplement> = {};

export type SandboxLeadSummary = LeadSummary & {
  last_activity_at?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  lead_source?: string | null;
  created_at?: string | null;
  contact_name?: string | null;
};

export type LeadQuickCreate = {
  hospitalName: string;
  country: string;
  phone: string;
  contactName?: string;
  address?: string;
  ownerName?: string;
  leadSource?: string;
};

export type LeadSupplement = {
  hospitalScale: LeadHospitalScale;
  activities: LeadActivity[];
  lastActivityAt?: string | null;
  conversion?: LeadConversionResult | null;
};

function readAll(): SandboxLeadSummary[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SandboxLeadSummary[];
      if (Array.isArray(parsed)) {
        memoryStore = parsed;
        return parsed;
      }
    }
  } catch {
    // localStorage is unavailable in some test/SSR environments
  }
  return memoryStore;
}

function writeAll(rows: SandboxLeadSummary[]) {
  memoryStore = rows;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // keep the in-memory copy
  }
}

function readSupplements(): Record<string, LeadSupplement> {
  try {
    const raw = globalThis.localStorage?.getItem(SUPPLEMENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, LeadSupplement>;
      if (parsed && typeof parsed === 'object') {
        supplementMemory = parsed;
        return parsed;
      }
    }
  } catch {
    // keep in-memory fallback
  }
  return supplementMemory;
}

function writeSupplements(value: Record<string, LeadSupplement>) {
  supplementMemory = value;
  try {
    globalThis.localStorage?.setItem(SUPPLEMENT_KEY, JSON.stringify(value));
  } catch {
    // keep in-memory fallback
  }
}

function numericSeed(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function defaultScale(publicId: string): LeadHospitalScale {
  const seed = numericSeed(publicId);
  return {
    hospitalType: 'CLINIC',
    doctorCount: 1 + (seed % 5),
    chairCount: 4 + (seed % 9),
    staffCount: 6 + (seed % 15),
    mainSpecialty: ''
  };
}

export function resetSandboxLeads() {
  memoryStore = [];
  supplementMemory = {};
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
    globalThis.localStorage?.removeItem(SUPPLEMENT_KEY);
  } catch {
    // ignore
  }
}

export function listSandboxLeads(search = ''): SandboxLeadSummary[] {
  const keyword = search.trim().toLocaleLowerCase();
  return readAll().filter(row => {
    if (!keyword) return true;
    return [row.public_id, row.hospital_name, row.contact_name ?? '', row.phone ?? '', row.owner_name ?? '', row.business_no ?? '']
      .some(value => value.toLocaleLowerCase().includes(keyword));
  });
}

export function createSandboxLead(input: LeadQuickCreate): SandboxLeadSummary {
  const now = new Date().toISOString();
  const created: SandboxLeadSummary = {
    public_id: createPublicId(),
    hospital_name: input.hospitalName.trim(),
    status: 'NEW',
    owner_name: input.ownerName?.trim() || input.contactName?.trim() || null,
    contact_name: input.contactName?.trim() || null,
    phone: input.phone.trim(),
    address: input.address?.trim() || null,
    sido: input.country.trim() || null,
    sigungu: null,
    business_no: null,
    last_activity_at: null,
    next_action: null,
    next_action_at: null,
    lead_source: input.leadSource?.trim() || null,
    created_at: now
  };
  writeAll([created, ...readAll()]);
  const supplements = readSupplements();
  supplements[created.public_id] = { hospitalScale: defaultScale(created.public_id), activities: [], lastActivityAt: null, conversion: null };
  writeSupplements({ ...supplements });
  return created;
}

export function updateSandboxLeadStatus(publicId: string, status: LeadStatus): SandboxLeadSummary {
  const rows = readAll();
  const index = rows.findIndex(row => row.public_id === publicId);
  if (index < 0) throw new Error('LEAD_NOT_FOUND');
  rows[index] = {
    ...rows[index],
    status,
    next_action: status === 'CONVERTED' || status === 'CONTACT_EXCLUDED' ? null : rows[index].next_action,
    next_action_at: status === 'CONVERTED' || status === 'CONTACT_EXCLUDED' ? null : rows[index].next_action_at
  };
  writeAll(rows);
  return rows[index];
}

export function getLeadSupplement(publicId: string): LeadSupplement {
  const supplements = readSupplements();
  const current = supplements[publicId];
  if (current) {
    return {
      hospitalScale: current.hospitalScale ?? defaultScale(publicId),
      activities: [...(current.activities ?? [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
      lastActivityAt: current.lastActivityAt ?? null,
      conversion: current.conversion ?? null
    };
  }
  return { hospitalScale: defaultScale(publicId), activities: [], lastActivityAt: null, conversion: null };
}

export function saveLeadHospitalScaleSupplement(publicId: string, hospitalScale: LeadHospitalScale): LeadSupplement {
  const supplements = readSupplements();
  const current = getLeadSupplement(publicId);
  const next = { ...current, hospitalScale: { ...hospitalScale } };
  writeSupplements({ ...supplements, [publicId]: next });
  return next;
}

export function addLeadActivitySupplement(publicId: string, ownerName: string, input: LeadActivityInput): LeadSupplement {
  const supplements = readSupplements();
  const current = getLeadSupplement(publicId);
  const activity: LeadActivity = {
    id: `ACT-${Date.now()}`,
    type: input.type,
    occurredAt: input.occurredAt,
    title: input.title,
    summary: input.summary,
    ownerName
  };
  const next: LeadSupplement = {
    ...current,
    activities: [activity, ...current.activities].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    lastActivityAt: input.occurredAt
  };
  writeSupplements({ ...supplements, [publicId]: next });

  const leads = readAll();
  if (leads.some(row => row.public_id === publicId)) {
    writeAll(leads.map(row => row.public_id === publicId ? { ...row, last_activity_at: input.occurredAt } : row));
  }
  return next;
}

export function saveLeadConversionSupplement(publicId: string, conversion: LeadConversionResult): LeadSupplement {
  const supplements = readSupplements();
  const current = getLeadSupplement(publicId);
  const next: LeadSupplement = { ...current, conversion };
  writeSupplements({ ...supplements, [publicId]: next });

  const leads = readAll();
  if (leads.some(row => row.public_id === publicId)) {
    writeAll(leads.map(row => row.public_id === publicId ? {
      ...row,
      status: 'CONVERTED',
      next_action: null,
      next_action_at: null
    } : row));
  }
  return next;
}

export function applyLeadSupplement(row: SandboxLeadSummary): SandboxLeadSummary {
  const supplement = getLeadSupplement(row.public_id);
  return {
    ...row,
    status: supplement.conversion ? 'CONVERTED' : row.status,
    last_activity_at: supplement.lastActivityAt || row.last_activity_at || null,
    next_action: supplement.conversion ? null : row.next_action,
    next_action_at: supplement.conversion ? null : row.next_action_at
  };
}
